from __future__ import annotations

import asyncio
import inspect
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from quantagent.core.config import settings
from quantagent.core.db.repositories.source_binding_repository import SourceBindingRepository
from quantagent.core.db.session import create_session_factory
from quantagent.core.events import (
    EventBusRuntime,
    EventBusSettings,
    build_event_bus_runtime,
)
from quantagent.core.event_intake import (
    EventIntakeRoutedPublisher,
    IndustryEventContextBuilder,
    ModelConfigStructuredModelInvoker,
    ReviewOnlyStructuredModelInvoker,
    SingleCallEventIntakeRunner,
    SqlAlchemyEventIntakeRoutedEventStore,
)
from quantagent.core.db.repositories.event_intake_repository import EventIntakeRoutedEventRepository
from quantagent.core.model_config import ModelConfigService
from quantagent.core.registry import PluginRegistry, RegistryScanner
from quantagent.core.runtime import PluginRuntimeService
from quantagent.core.scheduling import SourceBindingService
from quantagent.core.worker_routing import (
    IndustryAnalysisRequestedPublisher,
    SourceBindingOwnerResolver,
    TopicPublishingIndustryGateway,
    WorkerArticleEnrichmentService,
    WorkerCapturedEventRoutingService,
)
from quantagent.worker.consumer import (
    AnalysisRequestProcessingScope,
    CapturedSourceEventHandler,
    IndustryAnalysisRequestHandler,
    InMemoryAnalysisRequestIntakeAuditSink,
    InMemoryWorkerRouteAuditSink,
    RoutedAgentRunConfig,
    RoutedAgentRunHandler,
    WorkerApprovalEventHandler,
    WorkerNotificationDispatchConfig,
    WorkerNotificationRequestedHandler,
)

logger = logging.getLogger(__name__)

WORKER_TOPICS = (
    "source.event.captured",
    "industry.analysis.requested",
    "event.routed",
    "action.requested",
    "approval.input_received",
    "notification.requested",
)


def create_worker_runtime() -> EventBusRuntime:
    """组装 worker 的 event bus runtime，不在入口定义协议细节。"""
    return build_event_bus_runtime(EventBusSettings.from_settings(settings))


@dataclass(frozen=True)
class WorkerApp:
    runtime: EventBusRuntime
    handler: CapturedSourceEventHandler
    analysis_request_handler: IndustryAnalysisRequestHandler
    routed_agent_run_handler: RoutedAgentRunHandler
    session: object
    approval_handler: WorkerApprovalEventHandler | None = None
    notification_handler: WorkerNotificationRequestedHandler | None = None
    plugin_runtime: PluginRuntimeService | None = None

    async def consume_once(self) -> None:
        logger.info(
            "Worker consume_once started: backend=%s group_id=%s topics=%s",
            getattr(self.runtime, "backend", "unknown"),
            settings.EVENT_BUS_KAFKA_DEFAULT_GROUP_ID,
            ",".join(WORKER_TOPICS),
        )
        await self.runtime.consumer.subscribe(
            topics=WORKER_TOPICS,
            group_id=settings.EVENT_BUS_KAFKA_DEFAULT_GROUP_ID,
            handler=_TopicDispatchHandler(
                captured_handler=self.handler,
                analysis_request_handler=self.analysis_request_handler,
                routed_agent_run_handler=self.routed_agent_run_handler,
                approval_handler=self.approval_handler,
                notification_handler=self.notification_handler,
            ),
        )

    async def consume_forever(self) -> None:
        # worker 默认作为长期 consumer 运行；run_once 只保留给测试和 smoke，避免文档与运行行为不一致。
        logger.info(
            "Worker service started: backend=%s group_id=%s topics=%s",
            getattr(self.runtime, "backend", "unknown"),
            settings.EVENT_BUS_KAFKA_DEFAULT_GROUP_ID,
            ",".join(WORKER_TOPICS),
        )
        await self.runtime.consumer.consume_forever(
            topics=WORKER_TOPICS,
            group_id=settings.EVENT_BUS_KAFKA_DEFAULT_GROUP_ID,
            handler=_TopicDispatchHandler(
                captured_handler=self.handler,
                analysis_request_handler=self.analysis_request_handler,
                routed_agent_run_handler=self.routed_agent_run_handler,
                approval_handler=self.approval_handler,
                notification_handler=self.notification_handler,
            ),
        )

    async def close(self) -> None:
        close = getattr(self.session, "close", None)
        if callable(close):
            close()
        if self.plugin_runtime is not None:
            plugin_close = getattr(self.plugin_runtime, "close", None)
            if callable(plugin_close):
                result = plugin_close()
                if inspect.isawaitable(result):
                    await result
        await self.runtime.close()


def create_worker_app() -> WorkerApp:
    runtime = create_worker_runtime()
    session_factory = create_session_factory()
    session = session_factory()
    registry = PluginRegistry(
        RegistryScanner(
            official_root=_repo_root() / "plugins",
            runtime_root=_repo_root() / "runtime" / "plugins",
        )
    )
    plugin_runtime = PluginRuntimeService()
    binding_service = SourceBindingService(SourceBindingRepository(session))
    handler = CapturedSourceEventHandler(
        routing_service=WorkerCapturedEventRoutingService(
            binding_service=binding_service,
            owner_resolver=SourceBindingOwnerResolver(),
            industry_gateway=TopicPublishingIndustryGateway(
                publisher=IndustryAnalysisRequestedPublisher(runtime.publisher)
            ),
            enrichment_service=WorkerArticleEnrichmentService(
                registry=registry,
                runtime=plugin_runtime,
                article_concurrency=settings.WORKER_ARTICLE_CONCURRENCY,
            ),
        ),
        audit_sink=InMemoryWorkerRouteAuditSink(),
    )
    # V1 默认不裸连真实 provider；未配置 AgentRuntime/provider 时发布 review outcome，避免静默丢弃或假装已分析。
    intake_invoker = _build_intake_invoker(session)
    analysis_request_handler = IndustryAnalysisRequestHandler(
        context_builder=IndustryEventContextBuilder(),
        runner=SingleCallEventIntakeRunner(invoker=intake_invoker),
        routed_publisher=EventIntakeRoutedPublisher(runtime.publisher),
        audit_sink=InMemoryAnalysisRequestIntakeAuditSink(),
        routed_event_store=SqlAlchemyEventIntakeRoutedEventStore(
            EventIntakeRoutedEventRepository(session)
        ),
        commit=session.commit,
        rollback=session.rollback,
        article_concurrency=settings.WORKER_ARTICLE_CONCURRENCY,
        processing_scope_factory=_build_analysis_processing_scope_factory(session_factory),
    )
    routed_agent_run_handler = RoutedAgentRunHandler(
        session_factory=session_factory,
        config=RoutedAgentRunConfig(encryption_key=settings.MODEL_CONFIG_ENCRYPTION_KEY),
    )
    approval_handler = WorkerApprovalEventHandler(
        session_factory=session_factory,
        publisher=runtime.publisher,
    )
    notification_handler = WorkerNotificationRequestedHandler(
        registry=registry,
        runtime=plugin_runtime,
        publisher=runtime.publisher,
        config=WorkerNotificationDispatchConfig(
            enabled=settings.NOTIFICATION_DISPATCH_ENABLED,
            plugin_id=settings.NOTIFICATION_DISPATCH_PLUGIN_ID,
            plugin_config=settings.NOTIFICATION_DISPATCH_PLUGIN_CONFIG,
            channel=settings.NOTIFICATION_DISPATCH_CHANNEL,
        ),
    )
    return WorkerApp(
        runtime=runtime,
        handler=handler,
        analysis_request_handler=analysis_request_handler,
        routed_agent_run_handler=routed_agent_run_handler,
        session=session,
        approval_handler=approval_handler,
        notification_handler=notification_handler,
        plugin_runtime=plugin_runtime,
    )


async def run_once() -> None:
    _configure_logging()
    app = create_worker_app()
    try:
        await app.consume_once()
    finally:
        await app.close()


async def run_forever() -> None:
    _configure_logging()
    app = create_worker_app()
    try:
        await app.consume_forever()
    finally:
        await app.close()


def run() -> None:
    _configure_logging()
    asyncio.run(run_forever())


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[5]


def _build_intake_invoker(session: object):
    if settings.MODEL_CONFIG_ENCRYPTION_KEY:
        service = ModelConfigService(session, encryption_key=settings.MODEL_CONFIG_ENCRYPTION_KEY)
        return ModelConfigStructuredModelInvoker(service=service)
    return ReviewOnlyStructuredModelInvoker()


def _build_analysis_processing_scope_factory(session_factory, encryption_key: str | None = None):
    resolved_encryption_key = encryption_key if encryption_key is not None else settings.MODEL_CONFIG_ENCRYPTION_KEY

    def model_service_factory() -> ModelConfigService:
        if not resolved_encryption_key:
            raise ValueError("MODEL_CONFIG_ENCRYPTION_KEY must be configured for model service factory.")
        return ModelConfigService(session_factory(), encryption_key=resolved_encryption_key)

    def close_model_service(service: ModelConfigService) -> None:
        session = getattr(service, "_session", None)
        close = getattr(session, "close", None)
        if callable(close):
            close()

    def create_scope() -> AnalysisRequestProcessingScope:
        routed_session = session_factory()
        if resolved_encryption_key:
            invoker = ModelConfigStructuredModelInvoker(
                service_factory=model_service_factory,
                close_service=close_model_service,
            )
        else:
            invoker = ReviewOnlyStructuredModelInvoker()
        return AnalysisRequestProcessingScope(
            runner=SingleCallEventIntakeRunner(invoker=invoker),
            routed_event_store=SqlAlchemyEventIntakeRoutedEventStore(
                EventIntakeRoutedEventRepository(routed_session)
            ),
            commit=routed_session.commit,
            rollback=routed_session.rollback,
            close=routed_session.close,
        )

    return create_scope


def _configure_logging() -> None:
    level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


class _EnvelopeHandler(Protocol):
    async def handle(self, envelope) -> None: ...


@dataclass(frozen=True)
class _TopicDispatchHandler:
    captured_handler: _EnvelopeHandler
    analysis_request_handler: _EnvelopeHandler
    routed_agent_run_handler: _EnvelopeHandler
    approval_handler: WorkerApprovalEventHandler | None
    notification_handler: _EnvelopeHandler | None

    async def handle(self, envelope) -> None:
        logger.info(
            "Worker received event: topic=%s message_id=%s correlation_id=%s causation_id=%s",
            envelope.topic,
            envelope.id,
            envelope.correlation_id,
            envelope.causation_id,
        )
        if envelope.topic == "source.event.captured":
            await self.captured_handler.handle(envelope)
            return
        if envelope.topic == "industry.analysis.requested":
            await self.analysis_request_handler.handle(envelope)
            return
        if envelope.topic == "event.routed":
            await self.routed_agent_run_handler.handle(envelope)
            return
        if envelope.topic == "action.requested":
            if self.approval_handler is None:
                raise ValueError("Worker approval handler is not configured.")
            await self.approval_handler.handle_action_requested(envelope)
            return
        if envelope.topic == "approval.input_received":
            if self.approval_handler is None:
                raise ValueError("Worker approval handler is not configured.")
            await self.approval_handler.handle_approval_input_received(envelope)
            return
        if envelope.topic == "notification.requested":
            if self.notification_handler is None:
                raise ValueError("Worker notification handler is not configured.")
            await self.notification_handler.handle(envelope)
            return
        raise ValueError(f"Unsupported worker topic: {envelope.topic}")

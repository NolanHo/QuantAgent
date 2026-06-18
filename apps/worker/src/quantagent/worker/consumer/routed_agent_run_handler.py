from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol, TypeAlias
from uuid import uuid4

from sqlalchemy.orm import Session

from quantagent.agent.models import OpenAICompatibleChatModel
from quantagent.agent.runtime import AgentRuntime, AgentRunRequest, build_agent_chat_assets, build_agent_chat_run_context
from quantagent.agent.streaming.events import AgentRunEvent, AgentRunEventType
from quantagent.agent.tools import (
    build_build_action_plan_tool,
    build_evaluate_thesis_tool,
    build_get_account_context_tool,
    build_get_run_context_tool,
    build_search_web_tool,
    build_submit_action_plan_tool,
)
from quantagent.core.db.models.agent_chat import AgentChatMessageORM, AgentChatRunORM, AgentChatSessionORM
from quantagent.core.db.repositories.agent_chat_repository import AgentChatRepository
from quantagent.core.events import EventEnvelope
from quantagent.core.model_config import (
    ModelConfigCrypto,
    ModelConfigCryptoError,
    ModelConfigServiceError,
    ModelPresetKey,
)
from quantagent.core.model_config.repository import ModelProviderRepository
from quantagent.core.plugin_config import PluginConfigService, PluginConfigServiceError

logger = logging.getLogger(__name__)

TAVILY_PLUGIN_ID = "quantagent.official.source.tavily"
TAVILY_API_KEY_PATH = "api_key"
SEMICONDUCTOR_INDUSTRY_ID = "quantagent.official.industry.semiconductor"
SEMICONDUCTOR_MAIN_AGENT_ID = "quantagent.official.industry.semiconductor.agent.main"


class AgentRuntimePort(Protocol):
    async def run_stream(self, request: AgentRunRequest): ...


RuntimeFactory = Callable[[AgentRunRequest, Session], AgentRuntimePort]
SessionFactory: TypeAlias = Callable[[], Session]


@dataclass(frozen=True)
class RoutedAgentRunConfig:
    encryption_key: str | None = None
    model_timeout_seconds: float = 60.0
    runtime_factory: RuntimeFactory | None = None


@dataclass
class RoutedAgentRunHandler:
    session_factory: SessionFactory
    config: RoutedAgentRunConfig

    async def handle(self, envelope: EventEnvelope) -> None:
        session = self.session_factory()
        try:
            await self._handle_with_session(envelope, session)
        finally:
            session.close()

    async def _handle_with_session(self, envelope: EventEnvelope, session: Session) -> None:
        if not isinstance(envelope.payload, Mapping):
            raise ValueError("event.routed payload must be a mapping.")
        payload = dict(envelope.payload)
        if not _should_start_agent_run(payload):
            logger.info(
                "Skipping routed event for Agent Chat run: event_id=%s decision=%s target_industries=%s",
                envelope.id,
                payload.get("decision"),
                _target_industries(payload),
            )
            return

        repo = AgentChatRepository(session)
        chat_session = self._create_session(repo, envelope=envelope, payload=payload)
        user_message = repo.append_message(
            session_id=chat_session.session_id,
            role="user",
            kind="message",
            content=_input_message(payload),
            payload={"source_topic": envelope.topic, "routed_event_id": envelope.id},
        )
        run = self._create_run(repo, chat_session, envelope=envelope, payload=payload)
        session.commit()

        try:
            request = self._build_run_request(chat_session, run, session=session, message=user_message.content)
            runtime = self._build_runtime(request, session=session)
            async for event in runtime.run_stream(request):
                self._persist_runtime_event(repo, chat_session.session_id, run.run_id, event)
                session.commit()
            repo.update_run_status(run.run_id, status="completed")
            session.commit()
        except asyncio.CancelledError:
            self._mark_run_aborted(repo, run.run_id, session=session)
            raise
        except Exception as exc:  # noqa: BLE001
            logger.exception("Routed Agent Chat run failed: routed_event_id=%s run_id=%s", envelope.id, run.run_id)
            repo.update_run_status(run.run_id, status="failed", error_summary=_error_content(exc))
            repo.append_message(
                session_id=chat_session.session_id,
                run_id=run.run_id,
                role="assistant",
                kind="error",
                content=_error_content(exc),
                payload={"error": str(exc), "error_type": type(exc).__name__, "routed_event_id": envelope.id},
            )
            session.commit()

    def _create_session(
        self,
        repo: AgentChatRepository,
        *,
        envelope: EventEnvelope,
        payload: Mapping[str, object],
    ) -> AgentChatSessionORM:
        now = datetime.now(UTC)
        title = _session_title(payload)
        row = AgentChatSessionORM(
            session_id=f"chat_sess_{uuid4().hex}",
            thread_id=f"chat_thread_{uuid4().hex}",
            workspace_id=f"chat_workspace_{uuid4().hex}",
            industry_id=SEMICONDUCTOR_INDUSTRY_ID,
            agent_id=SEMICONDUCTOR_MAIN_AGENT_ID,
            title=title,
            status="active",
            metadata_json={
                "source": "event.routed",
                "routed_event_id": envelope.id,
                "routed_event_payload": _json_safe(payload),
                "routed_event_headers": _json_safe(envelope.headers),
                "correlation_id": envelope.correlation_id,
                "causation_id": envelope.causation_id,
            },
            created_at=now,
            updated_at=now,
        )
        return repo.create_session(row)

    def _create_run(
        self,
        repo: AgentChatRepository,
        chat_session: AgentChatSessionORM,
        *,
        envelope: EventEnvelope,
        payload: Mapping[str, object],
    ) -> AgentChatRunORM:
        return repo.create_run(
            AgentChatRunORM(
                run_id=f"chat_run_{uuid4().hex}",
                session_id=chat_session.session_id,
                agent_run_id=f"agent_run_{uuid4().hex}",
                trace_id=envelope.correlation_id or f"trace_{uuid4().hex}",
                status="running",
                metadata_json={
                    "source": "event.routed",
                    "routed_event_id": envelope.id,
                    "raw_event_id": _optional_text(_nested(payload, "source", "raw_event_id")),
                },
            )
        )

    def _build_run_request(
        self,
        chat_session: AgentChatSessionORM,
        run: AgentChatRunORM,
        *,
        session: Session,
        message: str,
    ) -> AgentRunRequest:
        assets = build_agent_chat_assets(industry_id=chat_session.industry_id, agent_id=chat_session.agent_id)
        runtime_policy = _runtime_policy_for_config(
            session=session,
            encryption_key=self.config.encryption_key,
            trace_id=run.trace_id,
            timeout_seconds=self.config.model_timeout_seconds,
            max_tool_calls=assets.tool_profile.max_tool_calls,
            requires_model=self.config.runtime_factory is None,
        )
        return AgentRunRequest(
            session_id=chat_session.session_id,
            thread_id=chat_session.thread_id,
            workspace_id=chat_session.workspace_id,
            agent_run_id=run.agent_run_id,
            event_id=str((chat_session.metadata_json or {}).get("routed_event_id") or run.run_id),
            industry_id=chat_session.industry_id,
            trace_id=run.trace_id,
            agent_definition=assets.agent_definition,
            run_context=build_agent_chat_run_context(chat_session, run, message=message),
            tool_profile=assets.tool_profile,
            runtime_policy=runtime_policy,
            input_message=message,
        )

    def _build_runtime(self, request: AgentRunRequest, *, session: Session) -> AgentRuntimePort:
        if self.config.runtime_factory is not None:
            return self.config.runtime_factory(request, session)
        return AgentRuntime(
            tools=[
                build_get_run_context_tool(request.run_context),
                build_search_web_tool(api_key=_resolve_tavily_api_key(session, self.config.encryption_key)),
                build_get_account_context_tool(request.run_context),
                build_evaluate_thesis_tool(request.run_context),
                build_build_action_plan_tool(request.run_context),
                build_submit_action_plan_tool(request.run_context),
            ]
        )

    def _persist_runtime_event(
        self,
        repo: AgentChatRepository,
        session_id: str,
        run_id: str,
        event: AgentRunEvent,
    ) -> AgentChatMessageORM:
        role, kind, content = _display_from_runtime_event(event)
        if event.type == AgentRunEventType.RUN_FAILED:
            repo.update_run_status(run_id, status="failed", error_summary=content)
        return repo.append_message(
            session_id=session_id,
            run_id=run_id,
            role=role,
            kind=kind,
            content=content,
            payload=_json_safe(event.payload),
        )

    def _mark_run_aborted(self, repo: AgentChatRepository, run_id: str, *, session: Session) -> None:
        try:
            repo.update_run_status(run_id, status="aborted")
            session.commit()
        except Exception:  # noqa: BLE001
            session.rollback()


def _runtime_policy_for_config(
    *,
    session: Session,
    encryption_key: str | None,
    trace_id: str,
    timeout_seconds: float,
    max_tool_calls: int,
    requires_model: bool,
):
    from quantagent.agent.definitions.models import RuntimePolicy

    if not requires_model:
        return RuntimePolicy(model=None, max_tool_calls=max_tool_calls, max_subagent_tasks=1)
    return RuntimePolicy(
        model=_model_from_config(
            session=session,
            encryption_key=encryption_key,
            trace_id=trace_id,
            timeout_seconds=timeout_seconds,
        ),
        max_tool_calls=max_tool_calls,
        max_subagent_tasks=1,
    )


def _model_from_config(
    *,
    session: Session,
    encryption_key: str | None,
    trace_id: str,
    timeout_seconds: float,
) -> OpenAICompatibleChatModel:
    repository = ModelProviderRepository(session)
    binding = repository.get_preset_binding(ModelPresetKey.REASONING_TEXT)
    model = repository.get_provider_model(binding.primary_model_id) if binding and binding.primary_model_id else None
    if model is None:
        model = repository.find_global_default_model()
    if model is None:
        raise RuntimeError("No model configured for routed Agent Chat")
    provider = repository.get_provider(model.provider_id)
    if provider is None or not provider.enabled or not model.enabled:
        raise RuntimeError("Configured model is not usable for routed Agent Chat")
    if not provider.encrypted_api_key:
        raise RuntimeError("Model provider API key is missing")
    try:
        api_key = ModelConfigCrypto(encryption_key).decrypt(provider.encrypted_api_key)
    except (ModelConfigCryptoError, ModelConfigServiceError) as exc:
        raise RuntimeError("Model provider API key cannot be decrypted") from exc
    return OpenAICompatibleChatModel(
        api_key=api_key,
        base_url=provider.base_url,
        model_name=model.model_name,
        request_id=trace_id,
        timeout_seconds=timeout_seconds,
    )


def _resolve_tavily_api_key(session: Session, encryption_key: str | None) -> str | None:
    try:
        return PluginConfigService(session, encryption_key=encryption_key).resolve_secret(
            plugin_id=TAVILY_PLUGIN_ID,
            path=TAVILY_API_KEY_PATH,
        )
    except PluginConfigServiceError:
        # Tavily key 缺失不能阻塞整次 routed Agent Chat，search_web 会把失败作为工具事件返回。
        return None


def _should_start_agent_run(payload: Mapping[str, object]) -> bool:
    if payload.get("decision") != "route":
        return False
    return "semiconductor" in _target_industries(payload)


def _target_industries(payload: Mapping[str, object]) -> list[str]:
    routing = payload.get("routing")
    if not isinstance(routing, Mapping):
        return []
    value = routing.get("target_industries")
    if not isinstance(value, list | tuple):
        return []
    return [str(item) for item in value]


def _input_message(payload: Mapping[str, object]) -> str:
    structured = payload.get("structured_news")
    title = _optional_text(_mapping_value(structured, "canonical_title")) or "已路由半导体事件"
    summary = _optional_text(_mapping_value(structured, "short_summary")) or "请分析该事件。"
    return (
        f"生产事件已由 Router 路由给半导体 MainAgent。\n"
        f"标题：{title}\n"
        f"摘要：{summary}\n"
        "请先判断该事件是否构成重大利好或重大利空、是否值得进入交易行动链路。"
        "如果不值得交易，不要搜索、不要调用账户/行动工具，直接给出 record_only 总结。"
    )


def _session_title(payload: Mapping[str, object]) -> str:
    structured = payload.get("structured_news")
    title = _optional_text(_mapping_value(structured, "canonical_title"))
    return title[:120] if title else "半导体路由事件分析"


def _display_from_runtime_event(event: AgentRunEvent) -> tuple[str, str, str]:
    runtime_event = _runtime_event_from_payload(_json_safe(event.payload))
    if runtime_event is not None:
        role = _role_from_runtime_event(runtime_event)
        kind = str(
            _nested(runtime_event, "render", "content_kind")
            or _kind_from_runtime_event_type(str(runtime_event.get("event_type") or event.type))
        )
        content = _content_from_runtime_event(runtime_event)
        return role, kind, content
    if event.type == AgentRunEventType.MODEL_DELTA:
        return "assistant", "delta", event.content or ""
    if event.type == AgentRunEventType.MODEL_REASONING:
        return "assistant", "reasoning", event.content or json.dumps(event.payload, ensure_ascii=False, default=str)
    if event.type == AgentRunEventType.TODO_UPDATED:
        return "assistant", "todo", event.content or json.dumps(event.payload, ensure_ascii=False, default=str)
    if event.type in {AgentRunEventType.TOOL_STARTED, AgentRunEventType.TOOL_COMPLETED, AgentRunEventType.TOOL_FAILED}:
        return "tool", "tool", event.content or json.dumps(event.payload, ensure_ascii=False, default=str)
    if event.type in {AgentRunEventType.SUBAGENT_STARTED, AgentRunEventType.SUBAGENT_COMPLETED}:
        return "subagent", "subagent", event.content or json.dumps(event.payload, ensure_ascii=False, default=str)
    if event.type == AgentRunEventType.ARTIFACT_CREATED:
        return "assistant", "artifact", event.content or json.dumps(event.payload, ensure_ascii=False, default=str)
    if event.type == AgentRunEventType.INTERRUPT_REQUESTED:
        return "assistant", "interrupt", event.content or json.dumps(event.payload, ensure_ascii=False, default=str)
    if event.type == AgentRunEventType.RUN_OUTPUT:
        return "assistant", "final", event.content or ""
    if event.type == AgentRunEventType.RUN_FAILED:
        return "assistant", "error", event.content or str(event.payload.get("error") or "Agent run failed.")
    return "assistant", "system_event", event.content or json.dumps(event.payload, ensure_ascii=False, default=str)


def _role_from_runtime_event(runtime_event: Mapping[str, object]) -> str:
    actor_type = _nested(runtime_event, "actor", "type")
    if actor_type == "tool":
        return "tool"
    if actor_type == "subagent":
        return "subagent"
    return "assistant"


def _kind_from_runtime_event_type(event_type: str) -> str:
    if event_type == "agent.message.final":
        return "final"
    if event_type == "agent.message.delta":
        return "delta"
    if event_type == "agent.reasoning.delta":
        return "reasoning"
    if event_type.startswith("tool."):
        return "tool"
    if event_type.startswith("subagent."):
        return "subagent"
    if event_type == "todo.updated":
        return "todo"
    if event_type == "artifact.created":
        return "artifact"
    if event_type == "interrupt.requested":
        return "interrupt"
    if event_type == "run.failed":
        return "error"
    return "system_event"


def _content_from_runtime_event(runtime_event: Mapping[str, object]) -> str:
    content = runtime_event.get("content")
    if isinstance(content, Mapping) and isinstance(content.get("text"), str):
        return content["text"]
    tool = runtime_event.get("tool")
    if isinstance(tool, Mapping):
        error = tool.get("error")
        if isinstance(error, Mapping) and isinstance(error.get("message"), str):
            return error["message"]
        if tool.get("output") is not None:
            return json.dumps(tool["output"], ensure_ascii=False, default=str)
    subagent = runtime_event.get("subagent")
    if isinstance(subagent, Mapping) and isinstance(subagent.get("output"), str):
        return subagent["output"]
    return ""


def _runtime_event_from_payload(payload: Mapping[str, object]) -> dict[str, object] | None:
    value = payload.get("runtime_event")
    return dict(value) if isinstance(value, Mapping) else None


def _mapping_value(value: object, key: str) -> object:
    return value.get(key) if isinstance(value, Mapping) else None


def _nested(value: Mapping[str, object], *keys: str) -> object:
    current: object = value
    for key in keys:
        if not isinstance(current, Mapping):
            return None
        current = current.get(key)
    return current


def _optional_text(value: object) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _json_safe(value: object) -> dict[str, object]:
    if isinstance(value, Mapping):
        return json.loads(json.dumps(dict(value), ensure_ascii=False, default=str))
    return {}


def _error_content(exc: Exception) -> str:
    message = str(exc)
    return f"{type(exc).__name__}: {message}" if message else type(exc).__name__

from __future__ import annotations

import unittest
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from quantagent.core.approval import (
    ActionRequest,
    ApprovalDecisionStatus,
    ApprovalInput,
    ApprovalListQuery,
    ApprovalQueryService,
    ApprovalRequestStatus,
)
from quantagent.core.db.base import Base
from quantagent.core.db.repositories.approval_repository import SQLAlchemyApprovalRepository
from quantagent.core.events import EventEnvelope, InMemoryEventBus
from quantagent.core.model_config import ModelConfigCrypto
from quantagent.core.plugin_config import PluginConfigService
from quantagent.core.registry import PluginManifest, PluginRecord, PluginSource, PluginStatus, PluginType
from quantagent.plugin_sdk import NotificationSendResult
from quantagent.worker.consumer import (
    WorkerApprovalEventHandler,
    WorkerNotificationDispatchConfig,
    WorkerNotificationRequestedHandler,
)


class AgentActionApprovalDiscordLoopSmokeTestCase(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
        Base.metadata.create_all(self.engine)
        self.bus = InMemoryEventBus()

    def tearDown(self) -> None:
        self.engine.dispose()

    async def test_memory_loop_runs_from_agent_action_to_safe_terminal_approval(self) -> None:
        approval_handler = WorkerApprovalEventHandler(
            session_factory=lambda: Session(self.engine),
            publisher=self.bus,
        )
        notification_runtime = _RecordingRuntime()
        session_factory = sessionmaker(bind=self.engine, autoflush=False, expire_on_commit=False)
        encryption_key = ModelConfigCrypto.generate_key()
        config_session = session_factory()
        try:
            PluginConfigService(config_session, encryption_key=encryption_key).save(
                plugin_id="quantagent.official.notification.discord",
                schema={
                    "type": "object",
                    "required": ["webhook_url"],
                    "properties": {"webhook_url": {"type": "string", "sensitive": True, "minLength": 1}},
                },
                values={"webhook_url": "https://discord.example.invalid/api/webhooks/test"},
            )
            config_session.commit()
        finally:
            config_session.close()
        notification_handler = WorkerNotificationRequestedHandler(
            session_factory=session_factory,
            publisher=self.bus,
            registry=_RegistryWithRecord(),
            runtime=notification_runtime,
            config=WorkerNotificationDispatchConfig(
                enabled=True,
                plugin_id="quantagent.official.notification.discord",
                channel="discord",
                encryption_key=encryption_key,
            ),
        )
        notification_completed: list[EventEnvelope] = []
        approval_completed: list[EventEnvelope] = []

        await self.bus.subscribe(
            topics=("action.requested",),
            group_id="worker-approval-action",
            handler=_ActionRequestedAdapter(approval_handler),
        )
        await self.bus.subscribe(
            topics=("approval.input_received",),
            group_id="worker-approval-input",
            handler=_ApprovalInputReceivedAdapter(approval_handler),
        )
        await self.bus.subscribe(
            topics=("notification.requested",),
            group_id="worker-notification-dispatch",
            handler=notification_handler,
        )
        await self.bus.subscribe(
            topics=("notification.completed",),
            group_id="smoke-notification-completed",
            handler=_RecordingHandler(notification_completed),
        )
        await self.bus.subscribe(
            topics=("approval.completed",),
            group_id="smoke-approval-completed",
            handler=_RecordingHandler(approval_completed),
        )

        await self.bus.publish(
            EventEnvelope(
                id="evt-agent-nvda-action",
                topic="action.requested",
                payload=_nvda_action().to_mapping(),
                producer="api-agent-chat-smoke",
                created_at="2026-06-18T00:00:00+00:00",
                correlation_id="trace-nvda-smoke",
                causation_id="submission-nvda-smoke",
            )
        )

        with Session(self.engine) as session:
            repository = SQLAlchemyApprovalRepository(session)
            approval = repository.get_approval_request_by_action_id("action-nvda-smoke")
            self.assertIsNotNone(approval)
            self.assertEqual(approval.status, ApprovalRequestStatus.PENDING)
            # Web 审批台 REST query 以 DB read model 为真源；这里直接验证同一个 query service 可读到该审批项。
            page = ApprovalQueryService(repository).list_approvals(ApprovalListQuery(limit=100))
            self.assertEqual([item.id for item in page.items], [approval.id])
            approval_id = approval.id

        self.assertEqual(len(notification_completed), 1)
        self.assertTrue(notification_completed[0].payload["accepted"])
        self.assertEqual(notification_completed[0].payload["approval_id"], approval_id)
        self.assertIsNotNone(notification_runtime.last_call)
        self.assertEqual(notification_runtime.last_call["config"]["webhook_url"], "https://discord.example.invalid/api/webhooks/test")
        self.assertIn(f"审批 ID：{approval_id}", notification_runtime.last_call["input"]["text"])
        self.assertIn("交易计划详情", notification_runtime.last_call["input"]["text"])

        await self.bus.publish(
            EventEnvelope(
                id="evt-web-approval-input",
                topic="approval.input_received",
                payload=ApprovalInput(
                    id="input-web-nvda-smoke",
                    approval_id=approval_id,
                    channel="web",
                    actor_ref="user:local-smoke",
                    structured_payload={"intent": "approve"},
                    received_at="2026-06-18T00:01:00+00:00",
                ).to_mapping(),
                producer="web-approval-smoke",
                created_at="2026-06-18T00:01:00+00:00",
                correlation_id="trace-nvda-smoke",
                causation_id=approval_id,
            )
        )

        with Session(self.engine) as session:
            repository = SQLAlchemyApprovalRepository(session)
            approval = repository.get_approval_request(approval_id)
            self.assertIsNotNone(approval)
            self.assertEqual(approval.status, ApprovalRequestStatus.BLOCKED)
            decision = repository.latest_decision(approval_id)
            self.assertIsNotNone(decision)
            self.assertEqual(decision.status, ApprovalDecisionStatus.POLICY_GATE_FAILED)

        self.assertEqual(len(approval_completed), 1)
        self.assertEqual(approval_completed[0].payload["approval_id"], approval_id)
        self.assertEqual(approval_completed[0].payload["status"], ApprovalDecisionStatus.POLICY_GATE_FAILED.value)


class _ActionRequestedAdapter:
    def __init__(self, handler: WorkerApprovalEventHandler) -> None:
        self._handler = handler

    async def handle(self, envelope: EventEnvelope) -> None:
        await self._handler.handle_action_requested(envelope)


class _ApprovalInputReceivedAdapter:
    def __init__(self, handler: WorkerApprovalEventHandler) -> None:
        self._handler = handler

    async def handle(self, envelope: EventEnvelope) -> None:
        await self._handler.handle_approval_input_received(envelope)


class _RecordingHandler:
    def __init__(self, events: list[EventEnvelope]) -> None:
        self.events = events

    async def handle(self, envelope: EventEnvelope) -> None:
        self.events.append(envelope)


class _RegistryWithRecord:
    def get_plugin(self, _plugin_id: str):
        return PluginRecord(
            id="quantagent.official.notification.discord",
            source=PluginSource.OFFICIAL,
            path=Path("/tmp/fake-discord"),
            status=PluginStatus.VALID,
            manifest=PluginManifest(
                id="quantagent.official.notification.discord",
                name="Discord Notification",
                type=PluginType.NOTIFICATION,
                version="0.1.0",
                entrypoint="discord_plugin:plugin",
                capabilities=("notification.send",),
                config_schema="config.schema.json",
            ),
        )


class _RecordingRuntime:
    def __init__(self) -> None:
        self.last_call = None

    async def invoke(self, record, **kwargs):
        self.last_call = {"record": record, **kwargs}
        return type(
            "Invocation",
            (),
            {
                "result": type(
                    "PluginResult",
                    (),
                    {
                        "output": NotificationSendResult(
                            accepted=True,
                            retryable=False,
                            provider_message_id="discord-msg-nvda-smoke",
                            metadata={"code": "DISCORD_SENT", "message": "sent"},
                        ).to_mapping()
                    },
                )(),
                "error": None,
            },
        )()


def _nvda_action() -> ActionRequest:
    return ActionRequest(
        id="action-nvda-smoke",
        action_type="trade_plan",
        action_side="increase_risk",
        target_type="instrument",
        target_id="NVDA",
        instrument="NVDA",
        amount=9500.0,
        confidence_score=0.92,
        risk_flags=("valuation_rich",),
        proposed_payload={
            "summary": "NVDA dry-run plan",
            "orders": [{"symbol": "NVDA", "side": "buy", "notional_usd": 9500.0}],
            "risk_controls": {"stop_loss_pct": -4.5, "take_profit_pct": 8.0},
            "action_plan_summary": {
                "summary": "NVDA dry-run plan",
                "orders": [{"symbol": "NVDA", "side": "buy", "order_intent": "open", "notional_usd": 9500.0}],
                "risk_controls": {"stop_loss_pct": -4.5, "take_profit_pct": 8.0},
            },
        },
        strategy_policy={"requested_mode_hint": "auto_if_allowed"},
        user_policy={"manual_confirmation_required": True},
        ai_policy_hint={"idempotency_key": "nvda-action-smoke"},
        correlation_id="trace-nvda-smoke",
    )

if __name__ == "__main__":
    unittest.main()

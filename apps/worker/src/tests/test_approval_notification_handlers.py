from __future__ import annotations

import unittest
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from quantagent.core.approval import ActionRequest, ApprovalDecisionStatus, ApprovalInput, ApprovalRequestStatus
from quantagent.core.db.base import Base
from quantagent.core.db.repositories.approval_repository import SQLAlchemyApprovalRepository
from quantagent.core.events import EventEnvelope, InMemoryEventBus
from quantagent.core.model_config import ModelConfigCrypto
from quantagent.core.plugin_config import PluginConfigService
from quantagent.core.registry import PluginManifest, PluginRecord, PluginSource, PluginStatus, PluginType
from quantagent.plugin_sdk import NotificationSendResult
from quantagent.worker.consumer import WorkerApprovalEventHandler
from quantagent.worker.consumer.notification_handler import (
    DISCORD_NOTIFICATION_PLUGIN_ID,
    WorkerNotificationDispatchConfig,
    WorkerNotificationRequestedHandler,
)


class WorkerApprovalNotificationHandlerTestCase(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
        Base.metadata.create_all(self.engine)
        self.bus = InMemoryEventBus()

    def tearDown(self) -> None:
        self.engine.dispose()

    async def test_action_requested_creates_db_approval_and_notification_event(self) -> None:
        notifications: list[EventEnvelope] = []
        await self.bus.subscribe(
            topics=("notification.requested",),
            group_id="test-notifications",
            handler=_ListRecordingHandler(notifications),
        )
        handler = WorkerApprovalEventHandler(
            session_factory=lambda: Session(self.engine),
            publisher=self.bus,
        )

        await handler.handle_action_requested(
            EventEnvelope(
                id="evt-action-1",
                topic="action.requested",
                payload=_action().to_mapping(),
                producer="test",
                created_at="2026-06-18T00:00:00+00:00",
            )
        )

        with Session(self.engine) as session:
            repository = SQLAlchemyApprovalRepository(session)
            self.assertIsNotNone(repository.get_action_request("action-1"))
            approval = repository.get_approval_request_by_action_id("action-1")
            self.assertIsNotNone(approval)
        self.assertEqual(len(notifications), 1)
        self.assertEqual(notifications[0].topic, "notification.requested")
        self.assertEqual(notifications[0].payload["action_request_id"], "action-1")

    async def test_approval_input_received_completes_db_approval(self) -> None:
        handler = WorkerApprovalEventHandler(
            session_factory=lambda: Session(self.engine),
            publisher=self.bus,
        )
        await handler.handle_action_requested(
            EventEnvelope(
                id="evt-action-1",
                topic="action.requested",
                payload=_action().to_mapping(),
                producer="test",
                created_at="2026-06-18T00:00:00+00:00",
            )
        )

        with Session(self.engine) as session:
            approval = SQLAlchemyApprovalRepository(session).get_approval_request_by_action_id("action-1")
            self.assertIsNotNone(approval)
            approval_id = approval.id

        completed: list[EventEnvelope] = []
        await self.bus.subscribe(
            topics=("approval.completed",),
            group_id="test-approval-completed",
            handler=_ListRecordingHandler(completed),
        )

        await handler.handle_approval_input_received(
            EventEnvelope(
                id="evt-input-1",
                topic="approval.input_received",
                payload=ApprovalInput(
                    id="input-1",
                    approval_id=approval_id,
                    channel="discord",
                    actor_ref="discord:user-1",
                    raw_text=f"approval_id: {approval_id} approve",
                    structured_payload={"intent": "approve"},
                    received_at="2026-06-18T00:01:00+00:00",
                ).to_mapping(),
                producer="test",
                created_at="2026-06-18T00:01:00+00:00",
            )
        )

        with Session(self.engine) as session:
            approval = SQLAlchemyApprovalRepository(session).get_approval_request(approval_id)
            self.assertIsNotNone(approval)
            self.assertEqual(approval.status, ApprovalRequestStatus.BLOCKED)
        self.assertEqual(len(completed), 1)
        self.assertEqual(completed[0].topic, "approval.completed")
        self.assertEqual(completed[0].payload["approval_id"], approval_id)
        self.assertEqual(completed[0].payload["status"], ApprovalDecisionStatus.POLICY_GATE_FAILED.value)

    async def test_notification_requested_uses_saved_discord_webhook_plugin_config(self) -> None:
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        session_factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
        encryption_key = ModelConfigCrypto.generate_key()
        session = session_factory()
        try:
            PluginConfigService(session, encryption_key=encryption_key).save(
                plugin_id=DISCORD_NOTIFICATION_PLUGIN_ID,
                schema={
                    "type": "object",
                    "required": ["webhook_url"],
                    "properties": {
                        "webhook_url": {"type": "string", "sensitive": True, "minLength": 1},
                    },
                },
                values={"webhook_url": "https://discord.example.invalid/api/webhooks/test"},
            )
            session.commit()
        finally:
            session.close()

        bus = InMemoryEventBus()
        completed = _RecordingHandler()
        await bus.subscribe(topics=("notification.completed",), group_id="test", handler=completed)
        runtime = _RecordingRuntime()
        handler = WorkerNotificationRequestedHandler(
            session_factory=session_factory,
            publisher=bus,
            registry=_StubRegistry(),
            runtime=runtime,
            config=WorkerNotificationDispatchConfig(encryption_key=encryption_key),
        )

        await handler.handle(
            EventEnvelope(
                id="evt-notification-1",
                topic="notification.requested",
                payload={
                    "approval_id": "approval-1",
                    "action_request_id": "action-1",
                    "summary": "需要审批 NVDA dry-run 行动计划。",
                    "risk_direction": "increase_risk",
                    "required_confirmation_level": "strong_confirm",
                    "safe_context": {
                        "target_type": "symbol",
                        "target_id": "NVDA",
                        "action_type": "execute_order",
                        "urgency": "time_sensitive",
                        "risk_level": "high",
                        "action_plan_summary": {
                            "summary": "已生成 NVDA open_long 行动计划：notional $9,500。",
                            "orders": [{"symbol": "NVDA", "side": "buy", "order_intent": "open", "notional_usd": 9500}],
                            "risk_controls": {"stop_loss_pct": -4.5, "take_profit_pct": 8.0},
                        },
                    },
                },
                producer="approval-orchestration",
                created_at="2026-06-19T00:00:00Z",
                correlation_id="trace-1",
                causation_id="approval-1",
            )
        )

        self.assertEqual(runtime.last_call["config"]["webhook_url"], "https://discord.example.invalid/api/webhooks/test")
        self.assertNotIn("DISCORD_WEBHOOK_URL", str(runtime.last_call))
        text = runtime.last_call["input"]["text"]
        self.assertIn("QuantAgent 行动审批提醒", text)
        self.assertIn("目标对象：symbol:NVDA", text)
        self.assertIn("建议动作：提交 dry-run/mock 订单计划（execute_order）", text)
        self.assertIn("交易计划详情", text)
        self.assertIn("订单 1：NVDA buy/open，金额 $9,500", text)
        self.assertIn("/approvals/approval-1", text)
        self.assertNotIn("Reply with", text)
        self.assertEqual(len(completed.events), 1)
        self.assertEqual(completed.events[0].payload["code"], "SENT")
        engine.dispose()

    async def test_notification_requested_disabled_publishes_completed_summary(self) -> None:
        completed: list[EventEnvelope] = []
        await self.bus.subscribe(
            topics=("notification.completed",),
            group_id="test-completed",
            handler=_ListRecordingHandler(completed),
        )
        handler = WorkerNotificationRequestedHandler(
            session_factory=lambda: Session(self.engine),
            publisher=self.bus,
            registry=_EmptyRegistry(),
            runtime=_UnusedRuntime(),
            config=WorkerNotificationDispatchConfig(enabled=False),
        )

        await handler.handle(
            EventEnvelope(
                id="evt-notification-1",
                topic="notification.requested",
                payload={
                    "approval_id": "approval-1",
                    "action_request_id": "action-1",
                    "summary": "approval_id: approval-1",
                },
                producer="test",
                created_at="2026-06-18T00:00:00+00:00",
            )
        )

        self.assertEqual(len(completed), 1)
        self.assertEqual(completed[0].payload["code"], "NOTIFICATION_DISPATCH_DISABLED")
        self.assertFalse(completed[0].payload["accepted"])


class _ListRecordingHandler:
    def __init__(self, events: list[EventEnvelope]) -> None:
        self.events = events

    async def handle(self, envelope: EventEnvelope) -> None:
        self.events.append(envelope)


class _RecordingHandler:
    def __init__(self) -> None:
        self.events = []

    async def handle(self, envelope: EventEnvelope) -> None:
        self.events.append(envelope)


class _EmptyRegistry:
    def get_plugin(self, _plugin_id: str):
        return None


class _UnusedRuntime:
    async def invoke(self, *_args, **_kwargs):  # pragma: no cover
        raise AssertionError("disabled notification dispatch must not call runtime")


class _StubRegistry:
    def get_plugin(self, _plugin_id: str):
        return PluginRecord(
            id=DISCORD_NOTIFICATION_PLUGIN_ID,
            source=PluginSource.OFFICIAL,
            path=Path("/tmp/fake-discord"),
            status=PluginStatus.VALID,
            manifest=PluginManifest(
                id=DISCORD_NOTIFICATION_PLUGIN_ID,
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
        result = type(
            "PluginResult",
            (),
            {
                "output": NotificationSendResult(
                    accepted=True,
                    retryable=False,
                    metadata={"code": "SENT", "message": "sent"},
                ).to_mapping()
            },
        )()
        return type("Invocation", (), {"result": result, "error": None})()


def _action() -> ActionRequest:
    return ActionRequest(
        id="action-1",
        action_type="trade_plan",
        action_side="increase_risk",
        target_type="instrument",
        target_id="NVDA",
        instrument="NVDA",
        amount=9500.0,
        confidence_score=0.92,
        risk_flags=("valuation_rich",),
        proposed_payload={"summary": "NVDA dry-run plan"},
        strategy_policy={"requested_mode_hint": "manual"},
        user_policy={"manual_confirmation_required": True},
        ai_policy_hint={"idempotency_key": "nvda-action-1"},
    )


if __name__ == "__main__":
    unittest.main()

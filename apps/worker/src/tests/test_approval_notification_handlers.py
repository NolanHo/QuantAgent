from __future__ import annotations

import unittest
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from quantagent.core.approval import ActionRequest, ApprovalDecisionStatus, ApprovalInput, ApprovalRequestStatus
from quantagent.core.db.base import Base
from quantagent.core.db.repositories.approval_repository import SQLAlchemyApprovalRepository
from quantagent.core.events import EventEnvelope, InMemoryEventBus
from quantagent.core.registry import PluginManifest, PluginRecord, PluginSource, PluginStatus, PluginType
from quantagent.plugin_sdk import NotificationSendResult
from quantagent.worker.consumer import (
    WorkerApprovalEventHandler,
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
            handler=_RecordingHandler(notifications),
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
            handler=_RecordingHandler(completed),
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

    async def test_notification_requested_enabled_invokes_runtime_and_publishes_completed(self) -> None:
        completed: list[EventEnvelope] = []
        await self.bus.subscribe(
            topics=("notification.completed",),
            group_id="test-completed",
            handler=_RecordingHandler(completed),
        )
        runtime = _RecordingRuntime()
        handler = WorkerNotificationRequestedHandler(
            registry=_RegistryWithRecord(),
            runtime=runtime,
            publisher=self.bus,
            config=WorkerNotificationDispatchConfig(
                enabled=True,
                plugin_id="quantagent.official.notification.discord",
                plugin_config={"webhook_secret_ref": "env:DISCORD_WEBHOOK_URL"},
                channel="discord",
            ),
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

        self.assertIsNotNone(runtime.last_call)
        self.assertEqual(runtime.last_call["capability"], "notification.send")
        self.assertEqual(runtime.last_call["config"]["webhook_secret_ref"], "env:DISCORD_WEBHOOK_URL")
        self.assertEqual(runtime.last_call["input"]["channel"], "discord")
        self.assertEqual(len(completed), 1)
        self.assertTrue(completed[0].payload["accepted"])
        self.assertEqual(completed[0].payload["code"], "DISCORD_SENT")

    async def test_notification_requested_disabled_publishes_completed_summary(self) -> None:
        completed: list[EventEnvelope] = []
        await self.bus.subscribe(
            topics=("notification.completed",),
            group_id="test-completed",
            handler=_RecordingHandler(completed),
        )
        handler = WorkerNotificationRequestedHandler(
            registry=_EmptyRegistry(),
            runtime=_UnusedRuntime(),
            publisher=self.bus,
            config=WorkerNotificationDispatchConfig(
                enabled=False,
                plugin_id="quantagent.official.notification.discord",
                plugin_config={},
                channel="discord",
            ),
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


class _RecordingHandler:
    def __init__(self, events: list[EventEnvelope]) -> None:
        self.events = events

    async def handle(self, envelope: EventEnvelope) -> None:
        self.events.append(envelope)


class _EmptyRegistry:
    def get_plugin(self, _plugin_id: str):
        return None


class _UnusedRuntime:
    async def invoke(self, *_args, **_kwargs):  # pragma: no cover
        raise AssertionError("disabled notification dispatch must not call runtime")


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
                capabilities=("notification.send", "notification.receive"),
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
                            provider_message_id="discord-msg-1",
                            metadata={"code": "DISCORD_SENT", "message": "sent"},
                        ).to_mapping()
                    },
                )(),
                "error": None,
            },
        )()


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

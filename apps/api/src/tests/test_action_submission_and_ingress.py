from __future__ import annotations

import unittest

from fastapi import FastAPI

from quantagent.agent.tools import ActionSubmissionRequest
from quantagent.api.services.agent_action_submission import EventBusActionSubmissionPort
from quantagent.api.services.notification_ingress import _get_notification_approval_handoff
from quantagent.core.events import EventEnvelope, InMemoryEventBus
from quantagent.core.notifications.models import NotificationApprovalHandoffRequest


class ApiActionSubmissionAndIngressTestCase(unittest.IsolatedAsyncioTestCase):
    async def test_agent_action_submission_port_publishes_action_requested(self) -> None:
        bus = InMemoryEventBus()
        seen: list[EventEnvelope] = []
        await bus.subscribe(topics=("action.requested",), group_id="test", handler=_RecordingHandler(seen))
        port = EventBusActionSubmissionPort(bus)

        result = await port.submit(
            ActionSubmissionRequest(
                action_request_id="action-1",
                submission_id="submission-1",
                action_request={
                    "id": "action-1",
                    "action_type": "trade_plan",
                    "action_side": "increase_risk",
                    "target_type": "instrument",
                    "target_id": "NVDA",
                    "proposed_payload": {"summary": "masked"},
                },
                correlation_id="trace-1",
            )
        )

        self.assertEqual(result.dispatch_status, "action_requested")
        self.assertEqual(result.action_request_id, "action-1")
        self.assertEqual(len(seen), 1)
        self.assertEqual(seen[0].topic, "action.requested")
        self.assertEqual(seen[0].payload["target_id"], "NVDA")

    async def test_notification_ingress_default_handoff_uses_event_bus_publisher(self) -> None:
        app = FastAPI()
        bus = InMemoryEventBus()
        app.state.event_bus_runtime = type("Runtime", (), {"publisher": bus})()
        seen: list[EventEnvelope] = []
        await bus.subscribe(topics=("approval.input_received",), group_id="test", handler=_RecordingHandler(seen))
        request = type("Request", (), {"app": app})()

        handoff = _get_notification_approval_handoff(request)
        result = await handoff.handoff(
            NotificationApprovalHandoffRequest(
                handoff_id="handoff-1",
                fact_id="fact-1",
                plugin_id="quantagent.official.notification.discord",
                transport="discord",
                request_id="req-1",
                correlation_id="corr-1",
                interaction_id="interaction-1",
                source_id="source-1",
                text="approval_id: approval-1 approve",
                received_at="2026-06-18T00:00:00+00:00",
            )
        )

        self.assertEqual(result.status, "queued")
        self.assertEqual(len(seen), 1)
        self.assertEqual(seen[0].topic, "approval.input_received")
        self.assertEqual(seen[0].payload["approval_id"], "approval-1")


class _RecordingHandler:
    def __init__(self, seen: list[EventEnvelope]) -> None:
        self.seen = seen

    async def handle(self, envelope: EventEnvelope) -> None:
        self.seen.append(envelope)


if __name__ == "__main__":
    unittest.main()

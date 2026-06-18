from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from quantagent.agent.tools import ActionSubmissionPort, ActionSubmissionRequest, ActionSubmissionResult
from quantagent.core.events import EventBusPublisher, EventEnvelope, sanitize_mapping


class EventBusActionSubmissionPort(ActionSubmissionPort):
    def __init__(self, publisher: EventBusPublisher, *, producer: str = "api-agent-chat") -> None:
        self._publisher = publisher
        self._producer = producer

    async def submit(self, request: ActionSubmissionRequest) -> ActionSubmissionResult:
        envelope = EventEnvelope(
            id=f"evt_{uuid4().hex}",
            topic="action.requested",
            payload=sanitize_mapping(dict(request.action_request)),
            producer=self._producer,
            created_at=datetime.now(UTC).isoformat(),
            correlation_id=request.correlation_id,
            causation_id=request.submission_id,
            headers=sanitize_mapping(
                {
                    "action_request_id": request.action_request_id,
                    "submission_id": request.submission_id,
                }
            ),
        )
        published = await self._publisher.publish(envelope)
        return ActionSubmissionResult(
            action_request_id=request.action_request_id,
            submission_id=request.submission_id,
            dispatch_status="action_requested",
            approval_status_hint="pending_dispatch",
            notification_status_hint="pending_dispatch",
            metadata={"event_id": published.id, "topic": published.topic},
        )

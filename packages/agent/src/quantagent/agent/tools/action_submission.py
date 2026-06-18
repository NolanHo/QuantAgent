from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any, Protocol
from uuid import uuid4


@dataclass(frozen=True)
class ActionSubmissionRequest:
    action_request_id: str
    submission_id: str
    action_request: Mapping[str, Any]
    correlation_id: str | None = None


@dataclass(frozen=True)
class ActionSubmissionResult:
    action_request_id: str | None
    submission_id: str
    dispatch_status: str
    approval_status_hint: str
    notification_status_hint: str
    error_summary: str | None = None
    metadata: Mapping[str, Any] = field(default_factory=dict)


class ActionSubmissionPort(Protocol):
    async def submit(self, request: ActionSubmissionRequest) -> ActionSubmissionResult: ...


class NoopActionSubmissionPort:
    async def submit(self, request: ActionSubmissionRequest) -> ActionSubmissionResult:
        return ActionSubmissionResult(
            action_request_id=None,
            submission_id=request.submission_id,
            dispatch_status="action_submission_unavailable",
            approval_status_hint="unavailable",
            notification_status_hint="unavailable",
            error_summary="Action submission port is not configured.",
        )


def new_submission_id() -> str:
    return f"submission_{uuid4().hex}"


def new_action_request_id() -> str:
    return f"action_request_{uuid4().hex}"

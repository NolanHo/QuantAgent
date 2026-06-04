from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class ApprovalDecisionSummaryResponse(BaseModel):
    status: str
    intent: str | None = None
    reason_summary: str
    policy_gate_status: str
    execution_status: str


class ApprovalSummaryResponse(BaseModel):
    id: str
    status: str
    target_type: str
    target_id: str
    action_type: str
    action_side: str
    risk_level: str
    urgency: str
    summary: str
    required_confirmation_level: str
    expires_at: str | None = None
    expiration_action: str
    created_at: str | None = None
    updated_at: str | None = None
    latest_decision_summary: ApprovalDecisionSummaryResponse | None = None
    allowed_actions: list[str] = Field(default_factory=list)


class ApprovalListResponse(BaseModel):
    items: list[ApprovalSummaryResponse] = Field(default_factory=list)
    next_cursor: str | None = None


class ApprovalDetailResponse(ApprovalSummaryResponse):
    action_request_summary: dict[str, Any] = Field(default_factory=dict)
    allowed_channels: list[str] = Field(default_factory=list)
    policy_source: str
    inputs: list[dict[str, Any | None]] = Field(default_factory=list)
    evaluations: list[dict[str, Any | None]] = Field(default_factory=list)
    decisions: list[dict[str, Any | None]] = Field(default_factory=list)
    audit_refs: list[dict[str, Any | None]] = Field(default_factory=list)


class ApprovalActionRequest(BaseModel):
    input_id: str | None = Field(default=None, min_length=1, max_length=128)
    channel: Literal["web"] = "web"
    reason: str | None = Field(default=None, max_length=500)
    comment: str | None = Field(default=None, max_length=500)
    structured_payload: dict[str, Any] = Field(default_factory=dict)


class ApprovalActionResponse(BaseModel):
    approval: ApprovalSummaryResponse | None = None
    decision: ApprovalDecisionSummaryResponse | None = None
    evaluation: dict[str, Any | None] | None = None
    ignored: bool = False


class ApprovalListQueryParams(BaseModel):
    status: str | None = None
    risk_level: str | None = None
    required_confirmation_level: str | None = None
    expires_before: datetime | None = None
    cursor: str | None = None
    limit: int = 50
    sort: str = "-updated_at"

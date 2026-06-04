from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from quantagent.core.db.base import Base


def utcnow() -> datetime:
    return datetime.now(UTC)


class ApprovalActionRequestORM(Base):
    __tablename__ = "approval_action_requests"

    action_request_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    action_type: Mapped[str] = mapped_column(String(64), nullable=False)
    action_side: Mapped[str] = mapped_column(String(64), nullable=False)
    target_type: Mapped[str] = mapped_column(String(64), nullable=False)
    target_id: Mapped[str] = mapped_column(String(128), nullable=False)
    instrument: Mapped[str | None] = mapped_column(String(128), nullable=True)
    market: Mapped[str | None] = mapped_column(String(64), nullable=True)
    amount: Mapped[float | int | None] = mapped_column(JSON, nullable=True)
    leverage: Mapped[float | int | None] = mapped_column(JSON, nullable=True)
    confidence_score: Mapped[float | None] = mapped_column(JSON, nullable=True)
    risk_flags: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    urgency: Mapped[str] = mapped_column(String(32), nullable=False)
    proposed_payload_summary: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)
    strategy_policy_summary: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)
    user_policy_summary: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)
    ai_policy_hint_summary: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)
    correlation_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class ApprovalRequestORM(Base):
    __tablename__ = "approval_requests"

    approval_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    action_request_id: Mapped[str] = mapped_column(
        ForeignKey("approval_action_requests.action_request_id"),
        nullable=False,
    )
    target_type: Mapped[str] = mapped_column(String(64), nullable=False)
    target_id: Mapped[str] = mapped_column(String(128), nullable=False)
    action_type: Mapped[str] = mapped_column(String(64), nullable=False)
    action_side: Mapped[str] = mapped_column(String(64), nullable=False)
    risk_level: Mapped[str] = mapped_column(String(32), nullable=False)
    urgency: Mapped[str] = mapped_column(String(32), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    proposed_payload_summary: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)
    required_confirmation_level: Mapped[str] = mapped_column(String(32), nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expiration_action: Mapped[str] = mapped_column(String(32), nullable=False)
    policy_source: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    allowed_channels: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    latest_decision_record_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)
    finalized_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ApprovalInputORM(Base):
    __tablename__ = "approval_inputs"
    __table_args__ = (UniqueConstraint("approval_id", "input_id", name="uq_approval_inputs_approval_input"),)

    record_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    approval_id: Mapped[str] = mapped_column(ForeignKey("approval_requests.approval_id"), nullable=False)
    input_id: Mapped[str] = mapped_column(String(128), nullable=False)
    channel: Mapped[str] = mapped_column(String(64), nullable=False)
    actor_ref: Mapped[str] = mapped_column(String(128), nullable=False)
    raw_text_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    structured_payload_summary: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class ApprovalEvaluationORM(Base):
    __tablename__ = "approval_evaluations"
    __table_args__ = (UniqueConstraint("approval_id", "input_id", name="uq_approval_evaluations_approval_input"),)

    record_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    approval_id: Mapped[str] = mapped_column(ForeignKey("approval_requests.approval_id"), nullable=False)
    input_id: Mapped[str] = mapped_column(String(128), nullable=False)
    evaluator_type: Mapped[str] = mapped_column(String(64), nullable=False)
    interpreted_intent: Mapped[str] = mapped_column(String(32), nullable=False)
    confidence: Mapped[float] = mapped_column(JSON, nullable=False)
    extracted_changes_summary: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)
    requires_stronger_confirmation: Mapped[bool] = mapped_column(nullable=False, default=False)
    reason_summary: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class ApprovalDecisionORM(Base):
    __tablename__ = "approval_decisions"
    __table_args__ = (UniqueConstraint("approval_id", "input_id", name="uq_approval_decisions_approval_input"),)

    record_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    approval_id: Mapped[str] = mapped_column(ForeignKey("approval_requests.approval_id"), nullable=False)
    action_request_id: Mapped[str] = mapped_column(
        ForeignKey("approval_action_requests.action_request_id"),
        nullable=False,
    )
    input_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    intent: Mapped[str | None] = mapped_column(String(32), nullable=True)
    policy_gate_status: Mapped[str] = mapped_column(String(32), nullable=False)
    execution_status: Mapped[str] = mapped_column(String(32), nullable=False)
    reason_summary: Mapped[str] = mapped_column(Text, nullable=False)
    correlation_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    request_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class ApprovalAuditRecordORM(Base):
    __tablename__ = "approval_audit_records"

    record_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    approval_id: Mapped[str] = mapped_column(ForeignKey("approval_requests.approval_id"), nullable=False)
    actor_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    actor_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(64), nullable=False, default="approval")
    resource_id: Mapped[str] = mapped_column(String(128), nullable=False)
    before_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    after_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    request_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    channel: Mapped[str | None] = mapped_column(String(64), nullable=True)
    reason_summary: Mapped[str] = mapped_column(Text, nullable=False)
    record_refs: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)
    payload_summary: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


Index("ix_approval_requests_status_updated", ApprovalRequestORM.status, ApprovalRequestORM.updated_at)
Index("ix_approval_requests_risk_status", ApprovalRequestORM.risk_level, ApprovalRequestORM.status)
Index("ix_approval_requests_confirmation_status", ApprovalRequestORM.required_confirmation_level, ApprovalRequestORM.status)
Index("ix_approval_requests_expires_at", ApprovalRequestORM.expires_at)
Index("ix_approval_requests_action_request", ApprovalRequestORM.action_request_id, unique=True)
Index("ix_approval_inputs_approval_created", ApprovalInputORM.approval_id, ApprovalInputORM.created_at, ApprovalInputORM.record_id)
Index(
    "ix_approval_evaluations_approval_created",
    ApprovalEvaluationORM.approval_id,
    ApprovalEvaluationORM.created_at,
    ApprovalEvaluationORM.record_id,
)
Index(
    "ix_approval_decisions_approval_created",
    ApprovalDecisionORM.approval_id,
    ApprovalDecisionORM.created_at,
    ApprovalDecisionORM.record_id,
)
Index("ix_approval_decisions_input", ApprovalDecisionORM.input_id)
Index(
    "ix_approval_audit_records_approval_created",
    ApprovalAuditRecordORM.approval_id,
    ApprovalAuditRecordORM.created_at,
    ApprovalAuditRecordORM.record_id,
)
Index("ix_approval_audit_records_request_id", ApprovalAuditRecordORM.request_id)

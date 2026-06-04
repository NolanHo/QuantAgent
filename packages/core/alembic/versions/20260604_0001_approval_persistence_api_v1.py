"""approval persistence api v1

Revision ID: 20260604_0001
Revises: 20260603_0002
Create Date: 2026-06-04
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260604_0001"
down_revision: str | Sequence[str] | None = "20260603_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "approval_action_requests",
        sa.Column("action_request_id", sa.String(length=64), nullable=False),
        sa.Column("action_type", sa.String(length=64), nullable=False),
        sa.Column("action_side", sa.String(length=64), nullable=False),
        sa.Column("target_type", sa.String(length=64), nullable=False),
        sa.Column("target_id", sa.String(length=128), nullable=False),
        sa.Column("instrument", sa.String(length=128), nullable=True),
        sa.Column("market", sa.String(length=64), nullable=True),
        sa.Column("amount", sa.JSON(), nullable=True),
        sa.Column("leverage", sa.JSON(), nullable=True),
        sa.Column("confidence_score", sa.JSON(), nullable=True),
        sa.Column("risk_flags", sa.JSON(), nullable=False),
        sa.Column("urgency", sa.String(length=32), nullable=False),
        sa.Column("proposed_payload_summary", sa.JSON(), nullable=False),
        sa.Column("strategy_policy_summary", sa.JSON(), nullable=False),
        sa.Column("user_policy_summary", sa.JSON(), nullable=False),
        sa.Column("ai_policy_hint_summary", sa.JSON(), nullable=False),
        sa.Column("correlation_id", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("action_request_id"),
    )
    op.create_table(
        "approval_requests",
        sa.Column("approval_id", sa.String(length=64), nullable=False),
        sa.Column("action_request_id", sa.String(length=64), nullable=False),
        sa.Column("target_type", sa.String(length=64), nullable=False),
        sa.Column("target_id", sa.String(length=128), nullable=False),
        sa.Column("action_type", sa.String(length=64), nullable=False),
        sa.Column("action_side", sa.String(length=64), nullable=False),
        sa.Column("risk_level", sa.String(length=32), nullable=False),
        sa.Column("urgency", sa.String(length=32), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("proposed_payload_summary", sa.JSON(), nullable=False),
        sa.Column("required_confirmation_level", sa.String(length=32), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expiration_action", sa.String(length=32), nullable=False),
        sa.Column("policy_source", sa.String(length=128), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("allowed_channels", sa.JSON(), nullable=False),
        sa.Column("latest_decision_record_id", sa.String(length=64), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finalized_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["action_request_id"], ["approval_action_requests.action_request_id"]),
        sa.PrimaryKeyConstraint("approval_id"),
    )
    op.create_index("ix_approval_requests_action_request", "approval_requests", ["action_request_id"], unique=True)
    op.create_index(
        "ix_approval_requests_confirmation_status",
        "approval_requests",
        ["required_confirmation_level", "status"],
    )
    op.create_index("ix_approval_requests_expires_at", "approval_requests", ["expires_at"])
    op.create_index("ix_approval_requests_risk_status", "approval_requests", ["risk_level", "status"])
    op.create_index("ix_approval_requests_status_updated", "approval_requests", ["status", "updated_at"])

    op.create_table(
        "approval_inputs",
        sa.Column("record_id", sa.String(length=64), nullable=False),
        sa.Column("approval_id", sa.String(length=64), nullable=False),
        sa.Column("input_id", sa.String(length=128), nullable=False),
        sa.Column("channel", sa.String(length=64), nullable=False),
        sa.Column("actor_ref", sa.String(length=128), nullable=False),
        sa.Column("raw_text_summary", sa.Text(), nullable=True),
        sa.Column("structured_payload_summary", sa.JSON(), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["approval_id"], ["approval_requests.approval_id"]),
        sa.PrimaryKeyConstraint("record_id"),
        sa.UniqueConstraint("approval_id", "input_id", name="uq_approval_inputs_approval_input"),
    )
    op.create_index(
        "ix_approval_inputs_approval_created",
        "approval_inputs",
        ["approval_id", "created_at", "record_id"],
    )

    op.create_table(
        "approval_evaluations",
        sa.Column("record_id", sa.String(length=64), nullable=False),
        sa.Column("approval_id", sa.String(length=64), nullable=False),
        sa.Column("input_id", sa.String(length=128), nullable=False),
        sa.Column("evaluator_type", sa.String(length=64), nullable=False),
        sa.Column("interpreted_intent", sa.String(length=32), nullable=False),
        sa.Column("confidence", sa.JSON(), nullable=False),
        sa.Column("extracted_changes_summary", sa.JSON(), nullable=False),
        sa.Column("requires_stronger_confirmation", sa.Boolean(), nullable=False),
        sa.Column("reason_summary", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["approval_id"], ["approval_requests.approval_id"]),
        sa.PrimaryKeyConstraint("record_id"),
        sa.UniqueConstraint("approval_id", "input_id", name="uq_approval_evaluations_approval_input"),
    )
    op.create_index(
        "ix_approval_evaluations_approval_created",
        "approval_evaluations",
        ["approval_id", "created_at", "record_id"],
    )

    op.create_table(
        "approval_decisions",
        sa.Column("record_id", sa.String(length=64), nullable=False),
        sa.Column("approval_id", sa.String(length=64), nullable=False),
        sa.Column("action_request_id", sa.String(length=64), nullable=False),
        sa.Column("input_id", sa.String(length=128), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("intent", sa.String(length=32), nullable=True),
        sa.Column("policy_gate_status", sa.String(length=32), nullable=False),
        sa.Column("execution_status", sa.String(length=32), nullable=False),
        sa.Column("reason_summary", sa.Text(), nullable=False),
        sa.Column("correlation_id", sa.String(length=128), nullable=True),
        sa.Column("request_id", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["action_request_id"], ["approval_action_requests.action_request_id"]),
        sa.ForeignKeyConstraint(["approval_id"], ["approval_requests.approval_id"]),
        sa.PrimaryKeyConstraint("record_id"),
        sa.UniqueConstraint("approval_id", "input_id", name="uq_approval_decisions_approval_input"),
    )
    op.create_index(
        "ix_approval_decisions_approval_created",
        "approval_decisions",
        ["approval_id", "created_at", "record_id"],
    )
    op.create_index("ix_approval_decisions_input", "approval_decisions", ["input_id"])
    op.create_foreign_key(
        "fk_approval_requests_latest_decision_record_id",
        "approval_requests",
        "approval_decisions",
        ["latest_decision_record_id"],
        ["record_id"],
    )

    op.create_table(
        "approval_audit_records",
        sa.Column("record_id", sa.String(length=64), nullable=False),
        sa.Column("approval_id", sa.String(length=64), nullable=False),
        sa.Column("actor_id", sa.String(length=128), nullable=True),
        sa.Column("actor_type", sa.String(length=64), nullable=True),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("resource_type", sa.String(length=64), nullable=False),
        sa.Column("resource_id", sa.String(length=128), nullable=False),
        sa.Column("before_status", sa.String(length=32), nullable=True),
        sa.Column("after_status", sa.String(length=32), nullable=True),
        sa.Column("request_id", sa.String(length=128), nullable=True),
        sa.Column("channel", sa.String(length=64), nullable=True),
        sa.Column("reason_summary", sa.Text(), nullable=False),
        sa.Column("record_refs", sa.JSON(), nullable=False),
        sa.Column("payload_summary", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["approval_id"], ["approval_requests.approval_id"]),
        sa.PrimaryKeyConstraint("record_id"),
    )
    op.create_index(
        "ix_approval_audit_records_approval_created",
        "approval_audit_records",
        ["approval_id", "created_at", "record_id"],
    )
    op.create_index("ix_approval_audit_records_request_id", "approval_audit_records", ["request_id"])


def downgrade() -> None:
    op.drop_index("ix_approval_audit_records_request_id", table_name="approval_audit_records")
    op.drop_index("ix_approval_audit_records_approval_created", table_name="approval_audit_records")
    op.drop_table("approval_audit_records")
    op.drop_constraint(
        "fk_approval_requests_latest_decision_record_id",
        "approval_requests",
        type_="foreignkey",
    )
    op.drop_index("ix_approval_decisions_input", table_name="approval_decisions")
    op.drop_index("ix_approval_decisions_approval_created", table_name="approval_decisions")
    op.drop_table("approval_decisions")
    op.drop_index("ix_approval_evaluations_approval_created", table_name="approval_evaluations")
    op.drop_table("approval_evaluations")
    op.drop_index("ix_approval_inputs_approval_created", table_name="approval_inputs")
    op.drop_table("approval_inputs")
    op.drop_index("ix_approval_requests_status_updated", table_name="approval_requests")
    op.drop_index("ix_approval_requests_risk_status", table_name="approval_requests")
    op.drop_index("ix_approval_requests_expires_at", table_name="approval_requests")
    op.drop_index("ix_approval_requests_confirmation_status", table_name="approval_requests")
    op.drop_index("ix_approval_requests_action_request", table_name="approval_requests")
    op.drop_table("approval_requests")
    op.drop_table("approval_action_requests")

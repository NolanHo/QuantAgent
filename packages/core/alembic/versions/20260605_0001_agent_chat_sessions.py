"""agent chat sessions

Revision ID: 20260605_0001
Revises: 20260604_0002
Create Date: 2026-06-05
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260605_0001"
down_revision: str | Sequence[str] | None = "20260604_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "agent_chat_sessions",
        sa.Column("session_id", sa.String(length=96), nullable=False),
        sa.Column("thread_id", sa.String(length=96), nullable=False),
        sa.Column("workspace_id", sa.String(length=96), nullable=False),
        sa.Column("industry_id", sa.String(length=128), nullable=False),
        sa.Column("agent_id", sa.String(length=160), nullable=False),
        sa.Column("title", sa.String(length=240), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("session_id"),
        sa.UniqueConstraint("thread_id"),
    )
    op.create_index("ix_agent_chat_sessions_updated_at", "agent_chat_sessions", ["updated_at"])

    op.create_table(
        "agent_chat_runs",
        sa.Column("run_id", sa.String(length=96), nullable=False),
        sa.Column("session_id", sa.String(length=96), nullable=False),
        sa.Column("agent_run_id", sa.String(length=96), nullable=False),
        sa.Column("trace_id", sa.String(length=128), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_summary", sa.Text(), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["agent_chat_sessions.session_id"]),
        sa.PrimaryKeyConstraint("run_id"),
        sa.UniqueConstraint("agent_run_id"),
    )
    op.create_index("ix_agent_chat_runs_agent_run_id", "agent_chat_runs", ["agent_run_id"])
    op.create_index("ix_agent_chat_runs_session_created_at", "agent_chat_runs", ["session_id", "created_at"])

    op.create_table(
        "agent_chat_messages",
        sa.Column("message_id", sa.String(length=96), nullable=False),
        sa.Column("session_id", sa.String(length=96), nullable=False),
        sa.Column("run_id", sa.String(length=96), nullable=True),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("kind", sa.String(length=48), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["run_id"], ["agent_chat_runs.run_id"]),
        sa.ForeignKeyConstraint(["session_id"], ["agent_chat_sessions.session_id"]),
        sa.PrimaryKeyConstraint("message_id"),
        sa.UniqueConstraint("session_id", "seq", name="uq_agent_chat_messages_session_seq"),
    )
    op.create_index("ix_agent_chat_messages_session_seq", "agent_chat_messages", ["session_id", "seq"])


def downgrade() -> None:
    op.drop_index("ix_agent_chat_messages_session_seq", table_name="agent_chat_messages")
    op.drop_table("agent_chat_messages")
    op.drop_index("ix_agent_chat_runs_session_created_at", table_name="agent_chat_runs")
    op.drop_index("ix_agent_chat_runs_agent_run_id", table_name="agent_chat_runs")
    op.drop_table("agent_chat_runs")
    op.drop_index("ix_agent_chat_sessions_updated_at", table_name="agent_chat_sessions")
    op.drop_table("agent_chat_sessions")


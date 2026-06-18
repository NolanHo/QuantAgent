from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from quantagent.core.db.base import Base


def utcnow() -> datetime:
    return datetime.now(UTC)


class AgentChatSessionORM(Base):
    __tablename__ = "agent_chat_sessions"

    session_id: Mapped[str] = mapped_column(String(96), primary_key=True)
    thread_id: Mapped[str] = mapped_column(String(96), nullable=False, unique=True)
    workspace_id: Mapped[str] = mapped_column(String(96), nullable=False)
    industry_id: Mapped[str] = mapped_column(String(128), nullable=False)
    agent_id: Mapped[str] = mapped_column(String(160), nullable=False)
    title: Mapped[str | None] = mapped_column(String(240), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    metadata_json: Mapped[dict[str, object]] = mapped_column("metadata", JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)


class AgentChatRunORM(Base):
    __tablename__ = "agent_chat_runs"

    run_id: Mapped[str] = mapped_column(String(96), primary_key=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("agent_chat_sessions.session_id"), nullable=False)
    agent_run_id: Mapped[str] = mapped_column(String(96), nullable=False, unique=True)
    trace_id: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict[str, object]] = mapped_column("metadata", JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class AgentChatMessageORM(Base):
    __tablename__ = "agent_chat_messages"
    __table_args__ = (UniqueConstraint("session_id", "seq", name="uq_agent_chat_messages_session_seq"),)

    message_id: Mapped[str] = mapped_column(String(96), primary_key=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("agent_chat_sessions.session_id"), nullable=False)
    run_id: Mapped[str | None] = mapped_column(ForeignKey("agent_chat_runs.run_id"), nullable=True)
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    kind: Mapped[str] = mapped_column(String(48), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    payload: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


Index("ix_agent_chat_sessions_updated_at", AgentChatSessionORM.updated_at)
Index("ix_agent_chat_runs_session_created_at", AgentChatRunORM.session_id, AgentChatRunORM.created_at)
Index("ix_agent_chat_runs_agent_run_id", AgentChatRunORM.agent_run_id)
Index("ix_agent_chat_messages_session_seq", AgentChatMessageORM.session_id, AgentChatMessageORM.seq)


from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from quantagent.core.db.models.agent_chat import AgentChatMessageORM, AgentChatRunORM, AgentChatSessionORM


class AgentChatRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def create_session(self, row: AgentChatSessionORM) -> AgentChatSessionORM:
        self._session.add(row)
        self._session.flush()
        return row

    def get_session(self, session_id: str) -> AgentChatSessionORM | None:
        return self._session.get(AgentChatSessionORM, session_id)

    def create_run(self, row: AgentChatRunORM) -> AgentChatRunORM:
        self._session.add(row)
        self._session.flush()
        return row

    def update_run_status(self, run_id: str, *, status: str, error_summary: str | None = None) -> AgentChatRunORM | None:
        row = self._session.get(AgentChatRunORM, run_id)
        if row is None:
            return None
        row.status = status
        row.error_summary = error_summary
        if status in {"completed", "failed", "aborted"}:
            row.completed_at = datetime.now(UTC)
        self._session.add(row)
        self._session.flush()
        return row

    def append_message(
        self,
        *,
        session_id: str,
        role: str,
        kind: str,
        content: str,
        payload: dict[str, object] | None = None,
        run_id: str | None = None,
        message_id: str | None = None,
    ) -> AgentChatMessageORM:
        next_seq = self.next_message_seq(session_id)
        row = AgentChatMessageORM(
            message_id=message_id or f"msg_{uuid4().hex}",
            session_id=session_id,
            run_id=run_id,
            seq=next_seq,
            role=role,
            kind=kind,
            content=content,
            payload=payload or {},
        )
        self._session.add(row)
        self._session.flush()
        return row

    def next_message_seq(self, session_id: str) -> int:
        statement = select(func.coalesce(func.max(AgentChatMessageORM.seq), 0)).where(
            AgentChatMessageORM.session_id == session_id
        )
        return int(self._session.execute(statement).scalar_one()) + 1

    def list_messages(self, session_id: str) -> list[AgentChatMessageORM]:
        statement: Select[tuple[AgentChatMessageORM]] = (
            select(AgentChatMessageORM)
            .where(AgentChatMessageORM.session_id == session_id)
            .order_by(AgentChatMessageORM.seq.asc(), AgentChatMessageORM.created_at.asc())
        )
        return list(self._session.scalars(statement).all())


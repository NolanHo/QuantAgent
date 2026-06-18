from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from dataclasses import dataclass

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from quantagent.core.db.models.agent_chat import AgentChatMessageORM, AgentChatRunORM, AgentChatSessionORM


@dataclass(frozen=True)
class AgentChatSessionSummary:
    session: AgentChatSessionORM
    latest_run: AgentChatRunORM | None
    message_count: int


class AgentChatRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def create_session(self, row: AgentChatSessionORM) -> AgentChatSessionORM:
        self._session.add(row)
        self._session.flush()
        return row

    def get_session(self, session_id: str) -> AgentChatSessionORM | None:
        return self._session.get(AgentChatSessionORM, session_id)

    def find_session_by_routed_event_id(self, routed_event_id: str) -> AgentChatSessionORM | None:
        # metadata 是 JSON 字段，当前 SQLite/Postgres 方言都可通过 SQLAlchemy JSON index 编译；
        # 这里把查询封在 repository，避免 API read model 层依赖具体 JSON 语法。
        statement: Select[tuple[AgentChatSessionORM]] = (
            select(AgentChatSessionORM)
            .where(AgentChatSessionORM.metadata_json["routed_event_id"].as_string() == routed_event_id)
            .order_by(AgentChatSessionORM.updated_at.desc(), AgentChatSessionORM.created_at.desc())
            .limit(1)
        )
        return self._session.scalars(statement).first()

    def find_latest_sessions_by_routed_event_ids(self, routed_event_ids: list[str]) -> dict[str, AgentChatSessionORM]:
        unique_ids = sorted({item for item in routed_event_ids if item})
        if not unique_ids:
            return {}
        statement: Select[tuple[AgentChatSessionORM]] = (
            select(AgentChatSessionORM)
            .where(AgentChatSessionORM.metadata_json["routed_event_id"].as_string().in_(unique_ids))
            .order_by(
                AgentChatSessionORM.metadata_json["routed_event_id"].as_string().asc(),
                AgentChatSessionORM.updated_at.desc(),
                AgentChatSessionORM.created_at.desc(),
            )
        )
        result: dict[str, AgentChatSessionORM] = {}
        for row in self._session.scalars(statement).all():
            routed_event_id = row.metadata_json.get("routed_event_id") if isinstance(row.metadata_json, dict) else None
            if isinstance(routed_event_id, str) and routed_event_id not in result:
                result[routed_event_id] = row
        return result

    def find_latest_session_summaries_by_routed_event_ids(self, routed_event_ids: list[str]) -> dict[str, AgentChatSessionSummary]:
        sessions = self.find_latest_sessions_by_routed_event_ids(routed_event_ids)
        if not sessions:
            return {}
        session_ids = [session.session_id for session in sessions.values()]
        latest_runs: dict[str, AgentChatRunORM] = {}
        runs_statement: Select[tuple[AgentChatRunORM]] = (
            select(AgentChatRunORM)
            .where(AgentChatRunORM.session_id.in_(session_ids))
            .order_by(AgentChatRunORM.session_id.asc(), AgentChatRunORM.started_at.desc(), AgentChatRunORM.created_at.desc())
        )
        for run in self._session.scalars(runs_statement).all():
            latest_runs.setdefault(run.session_id, run)

        count_statement = (
            select(AgentChatMessageORM.session_id, func.count(AgentChatMessageORM.message_id))
            .where(AgentChatMessageORM.session_id.in_(session_ids))
            .group_by(AgentChatMessageORM.session_id)
        )
        message_counts = {str(session_id): int(count) for session_id, count in self._session.execute(count_statement).all()}

        return {
            routed_event_id: AgentChatSessionSummary(
                session=session,
                latest_run=latest_runs.get(session.session_id),
                message_count=message_counts.get(session.session_id, 0),
            )
            for routed_event_id, session in sessions.items()
        }

    def create_run(self, row: AgentChatRunORM) -> AgentChatRunORM:
        self._session.add(row)
        self._session.flush()
        return row

    def list_runs(self, session_id: str) -> list[AgentChatRunORM]:
        statement: Select[tuple[AgentChatRunORM]] = (
            select(AgentChatRunORM)
            .where(AgentChatRunORM.session_id == session_id)
            .order_by(AgentChatRunORM.started_at.desc(), AgentChatRunORM.created_at.desc())
        )
        return list(self._session.scalars(statement).all())

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

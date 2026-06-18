from __future__ import annotations

from datetime import UTC, datetime
from unittest import TestCase

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from quantagent.core.db.base import Base
from quantagent.core.db.models.agent_chat import AgentChatRunORM, AgentChatSessionORM
from quantagent.core.db.repositories.agent_chat_repository import AgentChatRepository


class AgentChatRepositoryTest(TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.session = sessionmaker(bind=self.engine)()

    def tearDown(self) -> None:
        self.session.close()
        self.engine.dispose()

    def test_create_session_and_append_messages_in_order(self) -> None:
        repo = AgentChatRepository(self.session)
        now = datetime.now(UTC)
        repo.create_session(
            AgentChatSessionORM(
                session_id="session-1",
                thread_id="thread-1",
                workspace_id="workspace-1",
                industry_id="industry",
                agent_id="agent",
                status="active",
                metadata_json={},
                created_at=now,
                updated_at=now,
            )
        )
        repo.create_run(
            AgentChatRunORM(
                run_id="run-1",
                session_id="session-1",
                agent_run_id="agent-run-1",
                trace_id="trace-1",
                status="running",
                metadata_json={},
            )
        )

        repo.append_message(session_id="session-1", run_id="run-1", role="user", kind="message", content="hello")
        repo.append_message(session_id="session-1", run_id="run-1", role="assistant", kind="delta", content="world")

        messages = repo.list_messages("session-1")
        self.assertEqual([message.seq for message in messages], [1, 2])
        self.assertEqual([message.content for message in messages], ["hello", "world"])


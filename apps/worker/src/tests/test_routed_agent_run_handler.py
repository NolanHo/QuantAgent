from __future__ import annotations

import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from quantagent.agent.streaming.events import AgentRunEvent, AgentRunEventType
from quantagent.core.db.models.agent_chat import AgentChatMessageORM, AgentChatRunORM, AgentChatSessionORM
from quantagent.core.db.base import Base
from quantagent.core.events import EventEnvelope
from quantagent.worker.consumer.routed_agent_run_handler import RoutedAgentRunConfig, RoutedAgentRunHandler


class RoutedAgentRunHandlerTestCase(unittest.IsolatedAsyncioTestCase):
    async def test_handle_creates_session_run_and_messages_for_route_event(self) -> None:
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        session_factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
        handler = RoutedAgentRunHandler(
            session_factory=session_factory,
            config=RoutedAgentRunConfig(
                encryption_key=None,
                runtime_factory=lambda request, db_session: _FakeRuntime(request),
            ),
        )
        envelope = EventEnvelope(
            id="evt_routed_1",
            topic="event.routed",
            payload={
                "decision": "route",
                "routing": {"target_industries": ["semiconductor"], "priority": "high", "event_score": 0.91},
                "structured_news": {
                    "canonical_title": "NVIDIA earnings",
                    "short_summary": "Strong earnings print.",
                    "bullet_summary": ["Strong earnings print."],
                },
                "source": {"plugin_id": "quantagent.official.source.rss", "raw_event_id": "raw_1"},
                "article": {"content_completeness": "full"},
                "audit": {"reason_summary": "High impact event."},
            },
            producer="router",
            created_at="2026-06-18T00:00:00Z",
        )

        await handler.handle(envelope)

        session = session_factory()
        created_session = session.query(AgentChatSessionORM).one()
        self.assertIsNotNone(created_session)
        self.assertEqual(created_session.industry_id, "quantagent.official.industry.semiconductor")
        self.assertEqual(created_session.metadata_json["source"], "event.routed")
        self.assertEqual(created_session.metadata_json["routed_event_id"], "evt_routed_1")

        created_run = session.query(AgentChatRunORM).one()
        self.assertEqual(created_run.status, "completed")

        rows = session.query(AgentChatMessageORM).order_by(AgentChatMessageORM.seq.asc()).all()
        self.assertGreaterEqual(len(rows), 2)
        self.assertEqual(rows[0].role, "user")
        self.assertEqual(rows[1].role, "assistant")
        session.close()
        engine.dispose()

    async def test_handle_skips_non_route_decision(self) -> None:
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        session_factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
        handler = RoutedAgentRunHandler(
            session_factory=session_factory,
            config=RoutedAgentRunConfig(runtime_factory=lambda request, db_session: _FakeRuntime(request)),
        )

        await handler.handle(
            EventEnvelope(
                id="evt_routed_skip",
                topic="event.routed",
                payload={"decision": "discard", "routing": {"target_industries": ["semiconductor"]}},
                producer="router",
                created_at="2026-06-18T00:00:00Z",
            )
        )

        session = session_factory()
        self.assertEqual(session.query(AgentChatSessionORM).count(), 0)
        self.assertEqual(session.query(AgentChatRunORM).count(), 0)
        self.assertEqual(session.query(AgentChatMessageORM).count(), 0)
        session.close()
        engine.dispose()


class _FakeRuntime:
    def __init__(self, request) -> None:
        self.request = request

    async def run_stream(self, request):
        yield AgentRunEvent(
            agent_run_id=request.agent_run_id,
            trace_id=request.trace_id,
            type=AgentRunEventType.RUN_STARTED,
            seq=1,
            content="started",
            payload={
                "runtime_event": {
                    "schema_version": "agent-runtime-event.v1",
                    "event_id": "evt_1",
                    "event_type": "run.started",
                    "render": {"lane": "main", "group_id": "main", "target": "cot", "content_kind": "notice"},
                    "actor": {"type": "main_agent", "id": "main", "name": "main", "display_name": "main"},
                    "span": {"span_id": "span_1", "parent_span_id": None, "kind": "main_run"},
                }
            },
        )
        yield AgentRunEvent(
            agent_run_id=request.agent_run_id,
            trace_id=request.trace_id,
            type=AgentRunEventType.RUN_COMPLETED,
            seq=2,
            content="completed",
            payload={
                "runtime_event": {
                    "schema_version": "agent-runtime-event.v1",
                    "event_id": "evt_2",
                    "event_type": "run.completed",
                    "render": {"lane": "main", "group_id": "main", "target": "final", "content_kind": "message"},
                    "actor": {"type": "main_agent", "id": "main", "name": "main", "display_name": "main"},
                    "span": {"span_id": "span_1", "parent_span_id": None, "kind": "main_run"},
                }
            },
        )


if __name__ == "__main__":
    unittest.main()

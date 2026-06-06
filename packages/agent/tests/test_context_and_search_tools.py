from __future__ import annotations

import asyncio
from unittest import TestCase
from unittest.mock import patch

from quantagent.agent.runtime.context import RunContextSection, RunContextSnapshot, ToolRuntimeContext
from quantagent.agent.streaming.adapter import EventSequencer
from quantagent.agent.streaming.events import AgentRunEventType
from quantagent.agent.tools import build_get_run_context_tool, build_search_web_tool
from quantagent.agent.tools.adapter import ToolAdapter


class ContextAndSearchToolsTest(TestCase):
    def test_get_run_context_returns_bound_sections_and_runtime_ids(self) -> None:
        async def _run() -> None:
            run_context = RunContextSnapshot(
                context_id="context_1",
                sections=[
                    RunContextSection(
                        name="event",
                        summary="NVIDIA official earnings entered within 5 minutes.",
                        data={"symbols": ["NVDA"], "event_kind": "first_party_earnings_release"},
                    )
                ],
                content="fallback context",
            )
            adapter = ToolAdapter(runtime_context=_runtime_context(), sequencer=EventSequencer())

            result, events = await adapter.invoke(
                build_get_run_context_tool(run_context),
                {"sections": ["event"], "symbols": ["NVDA"]},
            )

            self.assertTrue(result["ok"])
            self.assertEqual(result["bound_context_id"], "context_1")
            self.assertEqual(result["session_id"], "session_1")
            self.assertEqual(result["thread_id"], "thread_1")
            self.assertEqual(result["workspace_id"], "workspace_1")
            self.assertEqual(result["agent_run_id"], "run_1")
            self.assertEqual(result["sections"][0]["name"], "event")
            self.assertEqual(result["sections"][0]["data"]["symbols"], ["NVDA"])
            self.assertEqual([event.type for event in events], [AgentRunEventType.TOOL_STARTED, AgentRunEventType.TOOL_COMPLETED])

        asyncio.run(_run())

    def test_get_run_context_accepts_section_aliases(self) -> None:
        async def _run() -> None:
            run_context = RunContextSnapshot(
                context_id="context_1",
                sections=[
                    RunContextSection(name="route_context", summary="Routed to semiconductor MainAgent.", data={"decision": "route"}),
                    RunContextSection(name="risk_policy", summary="Broker disabled.", data={"broker_mode": "disabled"}),
                    RunContextSection(name="recent_activity_summary", summary="No prior action.", data={"recent_same_topic_run": False}),
                ],
                content="fallback context",
            )
            adapter = ToolAdapter(runtime_context=_runtime_context(), sequencer=EventSequencer())

            result, _events = await adapter.invoke(
                build_get_run_context_tool(run_context),
                {"sections": ["route", "risk", "recent_activity"], "symbols": []},
            )

            self.assertEqual([section["name"] for section in result["sections"]], ["route_context", "risk_policy", "recent_activity_summary"])
            self.assertEqual(result["warnings"], [])

        asyncio.run(_run())

    def test_search_web_missing_tavily_key_is_recoverable_tool_failure(self) -> None:
        async def _run() -> None:
            adapter = ToolAdapter(runtime_context=_runtime_context(), sequencer=EventSequencer())

            with patch.dict("os.environ", {}, clear=True):
                result, events = await adapter.invoke(
                    build_search_web_tool(),
                    {"query": "NVIDIA earnings consensus", "topic": "finance"},
                )

            self.assertFalse(result["ok"])
            self.assertIn("未配置 TAVILY_API_KEY", result["error"])
            self.assertEqual([event.type for event in events], [AgentRunEventType.TOOL_STARTED, AgentRunEventType.TOOL_FAILED])
            self.assertEqual(events[-1].payload["name"], "search_web")
            self.assertEqual(events[-1].payload["input"]["query"], "NVIDIA earnings consensus")

        asyncio.run(_run())


def _runtime_context() -> ToolRuntimeContext:
    return ToolRuntimeContext(
        session_id="session_1",
        thread_id="thread_1",
        workspace_id="workspace_1",
        agent_run_id="run_1",
        event_id="event_1",
        industry_id="industry_semiconductor",
        agent_id="agent_main",
        trace_id="trace_1",
        tool_profile_id="tool_profile_1",
    )

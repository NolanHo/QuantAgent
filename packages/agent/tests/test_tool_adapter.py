from __future__ import annotations

import asyncio
from unittest import TestCase

from quantagent.agent.runtime.context import ToolRuntimeContext
from quantagent.agent.streaming.adapter import EventSequencer
from quantagent.agent.streaming.events import AgentRunEventType
from quantagent.agent.testing.fake_tools import build_echo_platform_tool
from quantagent.agent.tools.adapter import ToolAdapter


class ToolAdapterTest(TestCase):
    def test_tool_adapter_injects_hidden_runtime_context(self) -> None:
        async def _run() -> None:
            context = ToolRuntimeContext(
                session_id="session_1",
                thread_id="thread_1",
                workspace_id="workspace_1",
                agent_run_id="run_1",
                event_id="evt_1",
                industry_id="industry_test",
                agent_id="agent_test",
                trace_id="trace_1",
                tool_profile_id="profile_1",
            )
            adapter = ToolAdapter(runtime_context=context, sequencer=EventSequencer())

            result, events = await adapter.invoke(build_echo_platform_tool(), {"text": "hello"})

            self.assertEqual(result["agent_run_id"], "run_1")
            self.assertEqual(result["event_id"], "evt_1")
            self.assertEqual(events[0].payload["input"], {"text": "hello"})
            self.assertEqual(events[0].payload["tool_call_id"], events[0].payload["invocation_id"])
            self.assertEqual(events[-1].payload["input"], {"text": "hello"})
            self.assertEqual(events[-1].payload["result"]["agent_run_id"], "run_1")
            self.assertEqual(events[0].payload["actor_type"], "main")
            self.assertEqual(
                [event.type for event in events],
                [
                    AgentRunEventType.TOOL_STARTED,
                    AgentRunEventType.TOOL_COMPLETED,
                ],
            )

        asyncio.run(_run())

    def test_tool_adapter_marks_subagent_tool_events(self) -> None:
        async def _run() -> None:
            context = ToolRuntimeContext(
                session_id="session_1",
                thread_id="thread_1",
                workspace_id="workspace_1",
                agent_run_id="run_1",
                event_id="evt_1",
                industry_id="industry_test",
                agent_id="agent_test",
                trace_id="trace_1",
                tool_profile_id="profile_1",
                subagent_id="subagent_research",
                subagent_name="evidence_research_analyst",
            )
            adapter = ToolAdapter(runtime_context=context, sequencer=EventSequencer())

            _, events = await adapter.invoke(build_echo_platform_tool(), {"text": "hello"})

            for event in events:
                self.assertEqual(event.payload["actor_type"], "subagent")
                self.assertEqual(event.payload["subagent_id"], "subagent_research")
                self.assertEqual(event.payload["subagent_name"], "evidence_research_analyst")

        asyncio.run(_run())

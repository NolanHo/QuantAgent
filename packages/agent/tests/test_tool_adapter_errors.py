from __future__ import annotations

import asyncio
from unittest import TestCase

from pydantic import BaseModel, ConfigDict, Field

from quantagent.agent.runtime.context import ToolRuntimeContext
from quantagent.agent.streaming.adapter import EventSequencer
from quantagent.agent.streaming.events import AgentRunEventType
from quantagent.agent.tools.adapter import PlatformTool, ToolAdapter
from quantagent.agent.tools.profiles import ToolBinding


class FailingToolInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1)


class ToolAdapterErrorTest(TestCase):
    def test_tool_error_returns_raw_failure_result_and_failed_event_for_mvp_debugging(self) -> None:
        async def _run() -> None:
            def _fail(input_data: FailingToolInput, runtime_context: ToolRuntimeContext) -> dict[str, str]:
                raise RuntimeError("secret-token=/tmp/private prompt raw")

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
            tool = PlatformTool(
                binding=ToolBinding(tool_id="quantagent.test.fail", name="fail", description="Fail with raw debug output."),
                input_model=FailingToolInput,
                callable=_fail,
            )

            result, events = await adapter.invoke(tool, {"text": "hello"})

            self.assertEqual(result, {"ok": False, "error": "RuntimeError: secret-token=/tmp/private prompt raw"})
            self.assertEqual(
                [event.type for event in events],
                [AgentRunEventType.TOOL_STARTED, AgentRunEventType.TOOL_FAILED],
            )
            self.assertIn("secret-token", str(result))
            self.assertIn("prompt raw", str(events[-1].payload))

        asyncio.run(_run())

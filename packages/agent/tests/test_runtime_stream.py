from __future__ import annotations

import asyncio
from unittest import TestCase

from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langchain_core.messages import AIMessageChunk

from quantagent.agent.definitions.models import RuntimePolicy
from quantagent.agent.runtime import AgentRuntime
from quantagent.agent.streaming.events import AgentRunEventType
from quantagent.agent.testing import build_echo_run_request, scripted_echo_runner


class RuntimeStreamTest(TestCase):
    def test_runtime_scripted_stream_emits_lifecycle_and_artifact_events(self) -> None:
        async def _run() -> None:
            runtime = AgentRuntime(scripted_runner=scripted_echo_runner)

            events = [event async for event in runtime.run_stream(build_echo_run_request())]

            self.assertEqual(
                [event.type for event in events],
                [
                    AgentRunEventType.RUN_STARTED,
                    AgentRunEventType.TODO_UPDATED,
                    AgentRunEventType.ARTIFACT_CREATED,
                    AgentRunEventType.RUN_OUTPUT,
                    AgentRunEventType.RUN_COMPLETED,
                ],
            )
            self.assertEqual(events[0].seq, 1)
            self.assertTrue(events[-1].payload["artifact_ids"])

        asyncio.run(_run())

    def test_runtime_run_collects_stream_result(self) -> None:
        async def _run() -> None:
            runtime = AgentRuntime(scripted_runner=scripted_echo_runner)

            result = await runtime.run(build_echo_run_request())

            self.assertEqual(result.status, "completed")
            self.assertEqual(result.output_content, "Echo run produced final output.")
            self.assertTrue(result.artifact_refs)

        asyncio.run(_run())

    def test_runtime_failure_event_preserves_exception_text_for_mvp_debugging(self) -> None:
        async def _bad_runner(request, sequencer, artifact_store):
            raise RuntimeError("sk-secret prompt raw /tmp/private")
            yield  # pragma: no cover

        async def _run() -> None:
            runtime = AgentRuntime(scripted_runner=_bad_runner)

            events = [event async for event in runtime.run_stream(build_echo_run_request())]

            failed = events[-1]
            self.assertEqual(failed.type, AgentRunEventType.RUN_FAILED)
            self.assertEqual(failed.payload["error"], "sk-secret prompt raw /tmp/private")
            self.assertIn("sk-secret", str(failed.payload))
            self.assertIn("prompt raw", failed.content or "")

        asyncio.run(_run())

    def test_runtime_failure_preserves_safe_model_provider_error_code(self) -> None:
        async def _bad_runner(request, sequencer, artifact_store):
            raise RuntimeError("MODEL_PROVIDER_HTTP_ERROR:401")
            yield  # pragma: no cover

        async def _run() -> None:
            runtime = AgentRuntime(scripted_runner=_bad_runner)

            events = [event async for event in runtime.run_stream(build_echo_run_request())]

            failed = events[-1]
            self.assertEqual(failed.type, AgentRunEventType.RUN_FAILED)
            self.assertEqual(failed.payload["error"], "MODEL_PROVIDER_HTTP_ERROR:401")
            self.assertEqual(failed.content, "RuntimeError: MODEL_PROVIDER_HTTP_ERROR:401")

        asyncio.run(_run())

    def test_runtime_deepagents_stream_only_emits_assistant_text_deltas(self) -> None:
        class BindableFakeChatModel(FakeListChatModel):
            def bind_tools(self, tools=None, **kwargs):
                return self

        async def _run() -> None:
            base_request = build_echo_run_request()
            request = base_request.model_copy(
                update={
                    "agent_definition": base_request.agent_definition.model_copy(update={"tool_ids": [], "subagents": []}),
                    "tool_profile": base_request.tool_profile.model_copy(update={"tool_bindings": []}),
                    "runtime_policy": RuntimePolicy(model=BindableFakeChatModel(responses=["hello live deepagents"])),
                }
            )
            runtime = AgentRuntime()

            events = [event async for event in runtime.run_stream(request)]
            deltas = [event.content for event in events if event.type == AgentRunEventType.MODEL_DELTA]
            output = next(event for event in events if event.type == AgentRunEventType.RUN_OUTPUT)

            self.assertEqual("".join(deltas), "hellolivedeepagents")
            self.assertEqual(output.content, "hello live deepagents")
            self.assertNotEqual(output.content, "DeepAgents stream completed.")

        asyncio.run(_run())

    def test_runtime_deepagents_stream_uses_session_thread_and_message_mode(self) -> None:
        class CapturingGraph:
            def __init__(self) -> None:
                self.config = None
                self.stream_mode = None

            def stream(self, input_data, config=None, stream_mode=None):
                self.config = config
                self.stream_mode = stream_mode
                yield ("messages", (AIMessageChunk(content="hello "), {}))
                yield ("messages", (AIMessageChunk(content="world"), {}))
                yield ("updates", {"todos": [{"content": "完成分析", "status": "completed"}]})

        graph = CapturingGraph()

        async def _run() -> None:
            base_request = build_echo_run_request()
            request = base_request.model_copy(
                update={
                    "agent_definition": base_request.agent_definition.model_copy(update={"tool_ids": [], "subagents": []}),
                    "tool_profile": base_request.tool_profile.model_copy(update={"tool_bindings": []}),
                    "runtime_policy": RuntimePolicy(model=object()),
                }
            )
            runtime = AgentRuntime(deep_agent_factory=lambda _request, _tools: graph)

            events = [event async for event in runtime.run_stream(request)]

            self.assertEqual(graph.stream_mode, ["updates", "messages"])
            self.assertEqual(graph.config["configurable"]["thread_id"], request.thread_id)
            self.assertEqual(graph.config["configurable"]["agent_run_id"], request.agent_run_id)
            deltas = [event.content for event in events if event.type == AgentRunEventType.MODEL_DELTA]
            self.assertEqual(deltas, ["hello ", "world"])
            self.assertIn(AgentRunEventType.TODO_UPDATED, [event.type for event in events])
            output = next(event for event in events if event.type == AgentRunEventType.RUN_OUTPUT)
            self.assertEqual(output.content, "hello world")
            self.assertNotEqual(output.content, "DeepAgents stream completed.")

        asyncio.run(_run())

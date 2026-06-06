from __future__ import annotations

import asyncio
from unittest import TestCase

from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langchain_core.messages import AIMessageChunk
from langchain_core.messages import ToolMessage

from quantagent.agent.definitions.models import RuntimePolicy, SubAgentDefinition
from quantagent.agent.runtime import AgentRuntime
from quantagent.agent.streaming.adapter import EventSequencer
from quantagent.agent.streaming.events import AgentRunEventType
from quantagent.agent.testing import build_echo_platform_tool, build_echo_run_request, scripted_echo_runner


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
                self.subgraphs = None

            def stream(self, input_data, config=None, stream_mode=None, subgraphs=False):
                self.config = config
                self.stream_mode = stream_mode
                self.subgraphs = subgraphs
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
            self.assertTrue(graph.subgraphs)
            self.assertEqual(graph.config["configurable"]["thread_id"], request.thread_id)
            self.assertEqual(graph.config["configurable"]["agent_run_id"], request.agent_run_id)
            deltas = [event.content for event in events if event.type == AgentRunEventType.MODEL_DELTA]
            self.assertEqual(deltas, ["hello ", "world"])
            self.assertIn(AgentRunEventType.TODO_UPDATED, [event.type for event in events])
            output = next(event for event in events if event.type == AgentRunEventType.RUN_OUTPUT)
            self.assertEqual(output.content, "hello world")
            self.assertNotEqual(output.content, "DeepAgents stream completed.")
            runtime_event = output.payload["runtime_event"]
            self.assertEqual(runtime_event["schema_version"], "agent-runtime-event.v1")
            self.assertEqual(runtime_event["event_type"], "agent.message.final")
            self.assertEqual(runtime_event["render"]["lane"], "main")
            self.assertEqual(runtime_event["render"]["target"], "final")

        asyncio.run(_run())

    def test_runtime_skips_model_side_started_event_for_platform_tools(self) -> None:
        class CapturingGraph:
            def stream(self, input_data, config=None, stream_mode=None):
                yield (
                    "messages",
                    (
                        AIMessageChunk(
                            content="",
                            tool_calls=[{"name": "echo", "args": {"text": "hello"}, "id": "call_echo_1"}],
                        ),
                        {},
                    ),
                )

        async def _run() -> None:
            request = build_echo_run_request().model_copy(update={"runtime_policy": RuntimePolicy(model=object())})
            runtime = AgentRuntime(deep_agent_factory=lambda _request, _tools: CapturingGraph(), tools=[build_echo_platform_tool()])

            events = [event async for event in runtime.run_stream(request)]

            self.assertNotIn(AgentRunEventType.TOOL_STARTED, [event.type for event in events])

        asyncio.run(_run())

    def test_runtime_skips_deepagents_tool_message_for_platform_tools(self) -> None:
        class CapturingGraph:
            def stream(self, input_data, config=None, stream_mode=None):
                yield (
                    "messages",
                    (
                        AIMessageChunk(
                            content="",
                            tool_calls=[{"name": "echo", "args": {"text": "hello"}, "id": "call_echo_1"}],
                        ),
                        {},
                    ),
                )
                yield ("messages", (ToolMessage(content='{"echo":"hello"}', tool_call_id="call_echo_1"), {}))

        async def _run() -> None:
            request = build_echo_run_request().model_copy(update={"runtime_policy": RuntimePolicy(model=object())})
            runtime = AgentRuntime(deep_agent_factory=lambda _request, _tools: CapturingGraph(), tools=[build_echo_platform_tool()])

            events = [event async for event in runtime.run_stream(request)]

            self.assertNotIn(AgentRunEventType.TOOL_STARTED, [event.type for event in events])
            self.assertNotIn(AgentRunEventType.TOOL_COMPLETED, [event.type for event in events])

        asyncio.run(_run())

    def test_runtime_does_not_guess_tools_namespace_is_single_configured_subagent(self) -> None:
        class CapturingGraph:
            def stream(self, input_data, config=None, stream_mode=None, subgraphs=False):
                yield (
                    ("tools:task_1",),
                    "messages",
                    (
                        AIMessageChunk(
                            content="",
                            additional_kwargs={"reasoning_content": "Research Agent 查询外部证据。"},
                        ),
                        {},
                    ),
                )

        async def _run() -> None:
            base_request = build_echo_run_request()
            request = base_request.model_copy(
                update={
                    "agent_definition": base_request.agent_definition.model_copy(
                        update={
                            "subagents": [
                                SubAgentDefinition(
                                    subagent_id="subagent_research",
                                    name="evidence_research_analyst",
                                    description="负责公开证据检索。",
                                    system_prompt="你是 Research Agent。",
                                    tool_ids=["quantagent.test.echo"],
                                )
                            ]
                        }
                    ),
                    "runtime_policy": RuntimePolicy(model=object()),
                }
            )
            runtime = AgentRuntime(deep_agent_factory=lambda _request, _tools: CapturingGraph(), tools=[build_echo_platform_tool()])

            events = [event async for event in runtime.run_stream(request)]
            reasoning = next(event for event in events if event.type == AgentRunEventType.MODEL_REASONING)

            self.assertEqual(reasoning.payload["actor_type"], "main")
            self.assertNotIn("subagent_name", reasoning.payload)
            self.assertEqual(reasoning.payload["graph_namespace"], ["tools:task_1"])

        asyncio.run(_run())

    def test_runtime_binds_task_namespace_to_configured_subagent_after_task_call(self) -> None:
        class CapturingGraph:
            def stream(self, input_data, config=None, stream_mode=None, subgraphs=False):
                yield (
                    ("tools:task_1",),
                    "messages",
                    (
                        AIMessageChunk(
                            content="",
                            tool_calls=[
                                {
                                    "name": "task",
                                    "args": {"agent": "evidence_research_analyst", "instruction": "检索市场预期"},
                                    "id": "call_task_1",
                                }
                            ],
                        ),
                        {},
                    ),
                )
                yield (
                    ("tools:task_1",),
                    "messages",
                    (
                        AIMessageChunk(
                            content="",
                            additional_kwargs={"reasoning_content": "Research Agent 查询外部证据。"},
                        ),
                        {},
                    ),
                )
                yield (
                    ("tools:task_1",),
                    "messages",
                    (AIMessageChunk(content="已完成外部证据检索。"), {}),
                )

        async def _run() -> None:
            base_request = build_echo_run_request()
            request = base_request.model_copy(
                update={
                    "agent_definition": base_request.agent_definition.model_copy(
                        update={
                            "subagents": [
                                SubAgentDefinition(
                                    subagent_id="subagent_research",
                                    name="evidence_research_analyst",
                                    description="负责公开证据检索。",
                                    system_prompt="你是 Research Agent。",
                                    tool_ids=["quantagent.test.echo"],
                                )
                            ]
                        }
                    ),
                    "runtime_policy": RuntimePolicy(model=object()),
                }
            )
            runtime = AgentRuntime(deep_agent_factory=lambda _request, _tools: CapturingGraph(), tools=[build_echo_platform_tool()])

            events = [event async for event in runtime.run_stream(request)]
            reasoning = next(event for event in events if event.type == AgentRunEventType.MODEL_REASONING)
            delta = next(event for event in events if event.type == AgentRunEventType.MODEL_DELTA)

            self.assertEqual(reasoning.payload["actor_type"], "subagent")
            self.assertEqual(reasoning.payload["subagent_name"], "evidence_research_analyst")
            self.assertEqual(reasoning.payload["subagent_id"], "subagent_research")
            self.assertEqual(delta.payload["actor_type"], "subagent")
            self.assertEqual(delta.payload["subagent_name"], "evidence_research_analyst")
            task_tool = next(event for event in events if event.type == AgentRunEventType.TOOL_STARTED)
            task_runtime_event = task_tool.payload["runtime_event"]
            reasoning_runtime_event = reasoning.payload["runtime_event"]
            delta_runtime_event = delta.payload["runtime_event"]

            self.assertEqual(task_runtime_event["event_type"], "tool.started")
            self.assertEqual(task_runtime_event["render"]["lane"], "main")
            self.assertEqual(task_runtime_event["span"]["kind"], "tool_call")
            self.assertEqual(reasoning_runtime_event["event_type"], "agent.reasoning.delta")
            self.assertEqual(reasoning_runtime_event["render"]["lane"], "subagent")
            self.assertEqual(reasoning_runtime_event["render"]["group_id"], "span_subagent_call_task_1")
            self.assertEqual(reasoning_runtime_event["span"]["kind"], "subagent_run")
            self.assertEqual(delta_runtime_event["event_type"], "agent.message.delta")
            self.assertEqual(delta_runtime_event["render"]["group_id"], "span_subagent_call_task_1")

        asyncio.run(_run())

    def test_runtime_reuses_task_subagent_span_when_later_chunk_has_only_subagent_name(self) -> None:
        class CapturingGraph:
            def stream(self, input_data, config=None, stream_mode=None, subgraphs=False):
                yield (
                    ("tools:task_1",),
                    "messages",
                    (
                        AIMessageChunk(
                            content="",
                            tool_calls=[
                                {
                                    "name": "task",
                                    "args": {"agent": "evidence_research_analyst", "instruction": "检索市场预期"},
                                    "id": "call_task_1",
                                }
                            ],
                        ),
                        {},
                    ),
                )
                yield (
                    ("evidence_research_analyst:detached",),
                    "messages",
                    (
                        AIMessageChunk(
                            content="",
                            additional_kwargs={"reasoning_content": "只带 subagent name 的后续 chunk。"},
                        ),
                        {},
                    ),
                )

        async def _run() -> None:
            base_request = build_echo_run_request()
            request = base_request.model_copy(
                update={
                    "agent_definition": base_request.agent_definition.model_copy(
                        update={
                            "subagents": [
                                SubAgentDefinition(
                                    subagent_id="subagent_research",
                                    name="evidence_research_analyst",
                                    description="负责公开证据检索。",
                                    system_prompt="你是 Research Agent。",
                                    tool_ids=["quantagent.test.echo"],
                                )
                            ]
                        }
                    ),
                    "runtime_policy": RuntimePolicy(model=object()),
                }
            )
            runtime = AgentRuntime(deep_agent_factory=lambda _request, _tools: CapturingGraph(), tools=[build_echo_platform_tool()])

            events = [event async for event in runtime.run_stream(request)]
            reasoning = next(event for event in events if event.type == AgentRunEventType.MODEL_REASONING)
            runtime_event = reasoning.payload["runtime_event"]

            self.assertEqual(runtime_event["render"]["lane"], "subagent")
            self.assertEqual(runtime_event["render"]["group_id"], "span_subagent_call_task_1")
            self.assertEqual(runtime_event["subagent"]["task_call_id"], "call_task_1")

        asyncio.run(_run())

    def test_runtime_binds_task_subagent_type_argument_to_subagent_span(self) -> None:
        class CapturingGraph:
            def stream(self, input_data, config=None, stream_mode=None, subgraphs=False):
                yield (
                    ("tools:task_1",),
                    "messages",
                    (
                        AIMessageChunk(
                            content="",
                            tool_calls=[
                                {
                                    "name": "task",
                                    "args": {"subagent_type": "evidence_research_analyst", "description": "检索市场预期"},
                                    "id": "call_task_1",
                                }
                            ],
                        ),
                        {},
                    ),
                )
                yield (
                    ("tools:task_1",),
                    "messages",
                    (
                        AIMessageChunk(
                            content="",
                            additional_kwargs={"reasoning_content": "SubAgent 使用 Tavily 检索。"},
                        ),
                        {},
                    ),
                )
                yield (
                    ("tools:task_1",),
                    "messages",
                    (
                        AIMessageChunk(
                            content="",
                            tool_calls=[
                                {
                                    "name": "search_web",
                                    "args": {"query": "NVDA earnings consensus"},
                                    "id": "call_search_1",
                                }
                            ],
                        ),
                        {},
                    ),
                )

        async def _run() -> None:
            base_request = build_echo_run_request()
            request = base_request.model_copy(
                update={
                    "agent_definition": base_request.agent_definition.model_copy(
                        update={
                            "subagents": [
                                SubAgentDefinition(
                                    subagent_id="subagent_research",
                                    name="evidence_research_analyst",
                                    description="负责公开证据检索。",
                                    system_prompt="你是 Research Agent。",
                                    tool_ids=["quantagent.test.echo"],
                                )
                            ]
                        }
                    ),
                    "runtime_policy": RuntimePolicy(model=object()),
                }
            )
            runtime = AgentRuntime(deep_agent_factory=lambda _request, _tools: CapturingGraph(), tools=[build_echo_platform_tool()])

            events = [event async for event in runtime.run_stream(request)]
            reasoning = next(event for event in events if event.type == AgentRunEventType.MODEL_REASONING)
            search_tool = next(event for event in events if event.type == AgentRunEventType.TOOL_STARTED and event.payload.get("name") == "search_web")

            self.assertEqual(reasoning.payload["runtime_event"]["render"]["lane"], "subagent")
            self.assertEqual(reasoning.payload["runtime_event"]["render"]["group_id"], "span_subagent_call_task_1")
            self.assertEqual(search_tool.payload["runtime_event"]["render"]["lane"], "subagent")
            self.assertEqual(search_tool.payload["runtime_event"]["render"]["group_id"], "span_subagent_call_task_1")
            self.assertEqual(search_tool.payload["runtime_event"]["span"]["parent_span_id"], "span_subagent_call_task_1")

        asyncio.run(_run())

    def test_runtime_binds_later_tools_namespace_to_pending_task_subagent(self) -> None:
        class CapturingGraph:
            def stream(self, input_data, config=None, stream_mode=None, subgraphs=False):
                yield (
                    (),
                    "updates",
                    {
                        "agent": {
                            "messages": [
                                AIMessageChunk(
                                    content="",
                                    tool_calls=[
                                        {
                                            "name": "task",
                                            "args": {"subagent_type": "evidence_research_analyst", "description": "检索市场预期"},
                                            "id": "call_task_1",
                                        }
                                    ],
                                )
                            ]
                        }
                    },
                )
                yield (
                    ("tools:generated_subgraph_uuid",),
                    "messages",
                    (
                        AIMessageChunk(
                            content="",
                            additional_kwargs={"reasoning_content": "SubAgent 子图 reasoning 不应进入 Main。"},
                        ),
                        {},
                    ),
                )
                yield (
                    ("tools:generated_subgraph_uuid",),
                    "messages",
                    (
                        AIMessageChunk(content="SubAgent 子图正文不应进入 Main。"),
                        {},
                    ),
                )

        async def _run() -> None:
            base_request = build_echo_run_request()
            request = base_request.model_copy(
                update={
                    "agent_definition": base_request.agent_definition.model_copy(
                        update={
                            "subagents": [
                                SubAgentDefinition(
                                    subagent_id="subagent_research",
                                    name="evidence_research_analyst",
                                    description="负责公开证据检索。",
                                    system_prompt="你是 Research Agent。",
                                    tool_ids=["quantagent.test.echo"],
                                )
                            ]
                        }
                    ),
                    "runtime_policy": RuntimePolicy(model=object()),
                }
            )
            runtime = AgentRuntime(deep_agent_factory=lambda _request, _tools: CapturingGraph(), tools=[build_echo_platform_tool()])

            events = [event async for event in runtime.run_stream(request)]
            reasoning = next(event for event in events if event.type == AgentRunEventType.MODEL_REASONING)
            delta = next(event for event in events if event.type == AgentRunEventType.MODEL_DELTA)

            self.assertEqual(reasoning.payload["runtime_event"]["render"]["lane"], "subagent")
            self.assertEqual(delta.payload["runtime_event"]["render"]["lane"], "subagent")
            self.assertEqual(reasoning.payload["runtime_event"]["render"]["group_id"], "span_subagent_call_task_1")
            self.assertEqual(delta.payload["runtime_event"]["subagent"]["name"], "evidence_research_analyst")

        asyncio.run(_run())

    def test_runtime_summarizes_main_task_tool_result_without_subagent_report_dump(self) -> None:
        class CapturingGraph:
            def stream(self, input_data, config=None, stream_mode=None, subgraphs=False):
                yield (
                    ("tools:task_1",),
                    "messages",
                    (
                        AIMessageChunk(
                            content="",
                            tool_calls=[
                                {
                                    "name": "task",
                                    "args": {"subagent_type": "evidence_research_analyst", "description": "检索市场预期"},
                                    "id": "call_task_1",
                                }
                            ],
                        ),
                        {},
                    ),
                )
                yield (
                    ("tools:task_1",),
                    "messages",
                    (
                        ToolMessage(
                            content="SubAgent returned a very long research report with search_web failures.",
                            tool_call_id="call_task_1",
                            name="task",
                        ),
                        {},
                    ),
                )

        async def _run() -> None:
            base_request = build_echo_run_request()
            request = base_request.model_copy(
                update={
                    "agent_definition": base_request.agent_definition.model_copy(
                        update={
                            "subagents": [
                                SubAgentDefinition(
                                    subagent_id="subagent_research",
                                    name="evidence_research_analyst",
                                    description="负责公开证据检索。",
                                    system_prompt="你是 Research Agent。",
                                    tool_ids=["quantagent.test.echo"],
                                )
                            ]
                        }
                    ),
                    "runtime_policy": RuntimePolicy(model=object()),
                }
            )
            runtime = AgentRuntime(deep_agent_factory=lambda _request, _tools: CapturingGraph(), tools=[build_echo_platform_tool()])

            events = [event async for event in runtime.run_stream(request)]
            task_completed = next(
                event
                for event in events
                if event.type == AgentRunEventType.TOOL_COMPLETED and event.payload["runtime_event"]["tool"]["name"] == "task"
            )
            runtime_event = task_completed.payload["runtime_event"]

            self.assertEqual(runtime_event["render"]["lane"], "main")
            self.assertIsNone(runtime_event["tool"]["output"])
            self.assertIn("详细执行过程在 SubAgent 节点中展示", runtime_event["content"]["text"])
            self.assertNotIn("very long research report", runtime_event["content"]["text"])

        asyncio.run(_run())

    def test_runtime_maps_subagent_update_run_output_to_subagent_completed(self) -> None:
        class CapturingGraph:
            def stream(self, input_data, config=None, stream_mode=None, subgraphs=False):
                yield (
                    "messages",
                    (
                        AIMessageChunk(
                            content="",
                            tool_calls=[
                                {
                                    "name": "task",
                                    "args": {"subagent_type": "evidence_research_analyst", "description": "检索市场预期"},
                                    "id": "call_task_1",
                                }
                            ],
                        ),
                        {},
                    ),
                )
                yield (
                    ("tools:task_1",),
                    "updates",
                    {"agent": {"messages": [AIMessageChunk(content="SubAgent final research report")]}},
                )

        async def _run() -> None:
            base_request = build_echo_run_request()
            request = base_request.model_copy(
                update={
                    "agent_definition": base_request.agent_definition.model_copy(
                        update={
                            "subagents": [
                                SubAgentDefinition(
                                    subagent_id="subagent_research",
                                    name="evidence_research_analyst",
                                    description="负责公开证据检索。",
                                    system_prompt="你是 Research Agent。",
                                    tool_ids=["quantagent.test.echo"],
                                )
                            ]
                        }
                    ),
                    "runtime_policy": RuntimePolicy(model=object()),
                }
            )
            runtime = AgentRuntime(deep_agent_factory=lambda _request, _tools: CapturingGraph(), tools=[build_echo_platform_tool()])

            events = [event async for event in runtime.run_stream(request)]
            subagent_completed = next(
                event
                for event in events
                if event.payload["runtime_event"]["event_type"] == "subagent.completed"
                and event.content == "SubAgent final research report"
            )
            runtime_event = subagent_completed.payload["runtime_event"]

            self.assertEqual(runtime_event["render"]["lane"], "subagent")
            self.assertEqual(runtime_event["render"]["group_id"], "span_subagent_call_task_1")
            self.assertEqual(runtime_event["subagent"]["output"], "SubAgent final research report")
            self.assertFalse(
                any(
                    event.payload["runtime_event"]["event_type"] == "agent.message.final"
                    and event.content == "SubAgent final research report"
                    for event in events
                )
            )

        asyncio.run(_run())

    def test_runtime_maps_subagent_long_run_output_to_report_artifact(self) -> None:
        report = "\n".join(
            [
                "# NVIDIA FY2027 Q1 财报研究报告",
                "",
                "## 一手材料",
                "NVIDIA 官方财报显示数据中心业务继续高增长。",
                "",
                "| 指标 | 实际 |",
                "| --- | --- |",
                "| Revenue | $81.6B |",
                "",
                *[f"- 研究要点 {index}: 市场预期和盘后反应需要外部检索交叉验证。" for index in range(40)],
            ]
        )

        class CapturingGraph:
            def stream(self, input_data, config=None, stream_mode=None, subgraphs=False):
                yield (
                    "messages",
                    (
                        AIMessageChunk(
                            content="",
                            tool_calls=[
                                {
                                    "name": "task",
                                    "args": {"subagent_type": "evidence_research_analyst", "description": "检索市场预期"},
                                    "id": "call_task_1",
                                }
                            ],
                        ),
                        {},
                    ),
                )
                yield (
                    ("tools:task_1",),
                    "updates",
                    {"agent": {"messages": [AIMessageChunk(content=report)]}},
                )

        async def _run() -> None:
            base_request = build_echo_run_request()
            request = base_request.model_copy(
                update={
                    "agent_definition": base_request.agent_definition.model_copy(
                        update={
                            "subagents": [
                                SubAgentDefinition(
                                    subagent_id="subagent_research",
                                    name="evidence_research_analyst",
                                    description="负责公开证据检索。",
                                    system_prompt="你是 Research Agent。",
                                    tool_ids=["quantagent.test.echo"],
                                )
                            ]
                        }
                    ),
                    "runtime_policy": RuntimePolicy(model=object()),
                }
            )
            runtime = AgentRuntime(deep_agent_factory=lambda _request, _tools: CapturingGraph(), tools=[build_echo_platform_tool()])

            events = [event async for event in runtime.run_stream(request)]
            artifact = next(event for event in events if event.payload["runtime_event"]["event_type"] == "artifact.created")
            runtime_event = artifact.payload["runtime_event"]

            self.assertEqual(runtime_event["render"]["lane"], "subagent")
            self.assertEqual(runtime_event["render"]["target"], "cot")
            self.assertEqual(runtime_event["render"]["content_kind"], "artifact")
            self.assertEqual(runtime_event["content"]["json"]["artifact_type"], "report")
            self.assertEqual(runtime_event["content"]["json"]["content_markdown"], report)
            self.assertEqual(runtime_event["content"]["json"]["group_id"], "span_subagent_call_task_1")
            self.assertFalse(
                any(
                    event.payload["runtime_event"]["event_type"] in {"agent.message.final", "agent.message.delta"}
                    and event.content == report
                    for event in events
                )
            )

        asyncio.run(_run())

    def test_runtime_maps_main_intermediate_long_run_output_to_report_artifact(self) -> None:
        report = "# Main 中途分析报告\n\n" + "\n".join(f"- 分析点 {index}: 这是 MainAgent 中途产出的长报告。" for index in range(45))

        class CapturingGraph:
            def stream(self, input_data, config=None, stream_mode=None, subgraphs=False):
                yield ("updates", {"agent": {"messages": [AIMessageChunk(content=report)]}})
                yield ("messages", (AIMessageChunk(content="最终结论保留为 final。"), {}))

        async def _run() -> None:
            base_request = build_echo_run_request()
            request = base_request.model_copy(
                update={
                    "agent_definition": base_request.agent_definition.model_copy(update={"tool_ids": [], "subagents": []}),
                    "tool_profile": base_request.tool_profile.model_copy(update={"tool_bindings": []}),
                    "runtime_policy": RuntimePolicy(model=object()),
                }
            )
            runtime = AgentRuntime(deep_agent_factory=lambda _request, _tools: CapturingGraph())

            events = [event async for event in runtime.run_stream(request)]
            artifact = next(event for event in events if event.payload["runtime_event"]["event_type"] == "artifact.created")
            final = next(event for event in events if event.payload["runtime_event"]["event_type"] == "agent.message.final")

            self.assertEqual(artifact.payload["runtime_event"]["render"]["lane"], "main")
            self.assertEqual(artifact.payload["runtime_event"]["content"]["json"]["artifact_type"], "report")
            self.assertEqual(artifact.payload["runtime_event"]["content"]["json"]["content_markdown"], report)
            self.assertEqual(final.content, "最终结论保留为 final。")

        asyncio.run(_run())

    def test_langchain_tool_wrapper_supports_sync_invocation(self) -> None:
        runtime = AgentRuntime(tools=[build_echo_platform_tool()])
        request = build_echo_run_request()
        tools = runtime._build_langchain_tools(request, sequencer=EventSequencer())

        result = tools[0].invoke({"text": "hello"})

        self.assertEqual(result["echo"], "hello")
        self.assertEqual(result["agent_run_id"], request.agent_run_id)

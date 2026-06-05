from __future__ import annotations

from unittest import TestCase

from langchain_core.messages import AIMessage
from langchain_core.messages import AIMessageChunk
from langchain_core.messages import ToolMessage

from quantagent.agent.streaming.adapter import chunk_to_message_text, iter_deepagents_stream_events
from quantagent.agent.streaming.events import AgentRunEventType


class StreamingAdapterTest(TestCase):
    def test_chunk_to_message_text_extracts_deepagents_ai_message_content(self) -> None:
        summary = chunk_to_message_text({"model": {"messages": [AIMessage(content="hello from live model")]}})

        self.assertEqual(summary, "hello from live model")

    def test_chunk_to_message_text_preserves_sensitive_message_content_for_mvp_debugging(self) -> None:
        summary = chunk_to_message_text({"model": {"messages": [AIMessage(content="secret token sk-test")]}})

        self.assertEqual(summary, "secret token sk-test")

    def test_chunk_to_message_text_uses_structure_summary_for_unknown_mapping(self) -> None:
        summary = chunk_to_message_text({"content": "secret prompt raw output", "other": 1})

        self.assertEqual(summary, "deepagents mapping chunk keys=[content, other]")

    def test_chunk_to_message_text_uses_structure_summary_for_raw_string_chunk(self) -> None:
        summary = chunk_to_message_text("secret prompt raw output")

        self.assertEqual(summary, "deepagents string chunk length=24")

    def test_iter_deepagents_stream_events_maps_message_chunks(self) -> None:
        events = iter_deepagents_stream_events(("messages", (AIMessageChunk(content="hello"), {})))

        self.assertEqual(events[0][0], AgentRunEventType.MODEL_DELTA)
        self.assertEqual(events[0][1]["delta"], "hello")

    def test_iter_deepagents_stream_events_maps_reasoning_chunks(self) -> None:
        events = iter_deepagents_stream_events(
            ("messages", (AIMessageChunk(content="", additional_kwargs={"reasoning_content": "先判断缺口。"}), {}))
        )

        self.assertEqual(events[0][0], AgentRunEventType.MODEL_REASONING)
        self.assertEqual(events[0][1]["reasoning"], "先判断缺口。")

    def test_iter_deepagents_stream_events_maps_tool_call_chunks_from_messages(self) -> None:
        events = iter_deepagents_stream_events(
            (
                "messages",
                (
                    AIMessageChunk(
                        content="",
                        tool_call_chunks=[{"name": "write_todos", "args": "{\"todos\":[]}", "id": "call_1", "index": 0}],
                    ),
                    {},
                ),
            )
        )

        self.assertEqual(events[0][0], AgentRunEventType.TOOL_STARTED)
        self.assertEqual(events[0][1]["tool_call_id"], "call_1")
        self.assertEqual(events[0][1]["name"], "write_todos")
        self.assertEqual(events[0][1]["input"], {"todos": []})

    def test_iter_deepagents_stream_events_maps_tool_call_chunks_from_updates(self) -> None:
        events = iter_deepagents_stream_events(
            ("updates", {"tool_call_chunks": [{"name": "write_todos", "args": "{\"todos\":[]}", "id": "call_1"}]})
        )

        self.assertEqual(events[0][0], AgentRunEventType.TOOL_STARTED)
        self.assertEqual(events[0][1]["tool_call_id"], "call_1")
        self.assertEqual(events[0][1]["input"], {"todos": []})

    def test_iter_deepagents_stream_events_maps_tool_messages_in_messages_channel(self) -> None:
        events = iter_deepagents_stream_events(("messages", (ToolMessage(content='{"ok":true}', tool_call_id="call_1"), {})))

        self.assertEqual(events[0][0], AgentRunEventType.TOOL_COMPLETED)
        self.assertEqual(events[0][1]["tool_call_id"], "call_1")
        self.assertEqual(events[0][1]["result"], {"ok": True})

    def test_iter_deepagents_stream_events_maps_todos(self) -> None:
        events = iter_deepagents_stream_events(("updates", {"todos": [{"content": "检查", "status": "completed"}]}))

        self.assertEqual(events[0][0], AgentRunEventType.TODO_UPDATED)
        self.assertEqual(events[0][1]["todos"][0]["content"], "检查")

    def test_iter_deepagents_stream_events_preserves_unknown_updates(self) -> None:
        events = iter_deepagents_stream_events(("updates", {"unexpected": {"raw": "payload"}}))

        self.assertEqual(events[0][0], AgentRunEventType.RUNTIME_EVENT)
        self.assertEqual(events[0][1]["raw"]["unexpected"]["raw"], "payload")

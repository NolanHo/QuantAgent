from __future__ import annotations

from collections.abc import Iterator
from unittest import TestCase

from langchain_core.messages import AIMessage, HumanMessage

from quantagent.agent.models.openai_compatible import OpenAICompatibleChatModel


class StreamingOpenAICompatibleChatModel(OpenAICompatibleChatModel):
    def _post_chat_completion_stream(self, payload: dict):
        from langchain_core.messages import AIMessageChunk

        yield AIMessageChunk(content="hello ")
        yield AIMessageChunk(content="world")


class ToolCallingOpenAICompatibleChatModel(OpenAICompatibleChatModel):
    def _post_chat_completions(self, payload: dict) -> dict:
        return {
            "choices": [
                {
                    "message": {
                        "content": "",
                        "tool_calls": [
                            {
                                "id": "call_1",
                                "type": "function",
                                "function": {"name": "write_todos", "arguments": "{\"todos\": []}"},
                            }
                        ],
                    }
                }
            ]
        }

    def _post_chat_completion_stream(self, payload: dict):
        yield from super()._post_chat_completion_stream(payload)


class OpenAICompatibleChatModelTest(TestCase):
    def test_stream_yields_chat_generation_chunks(self) -> None:
        model = StreamingOpenAICompatibleChatModel(api_key="test-key", model_name="test-model")

        chunks = list(model._stream([HumanMessage(content="hi")]))

        self.assertEqual("".join(str(chunk.message.content) for chunk in chunks), "hello world")

    def test_generate_preserves_tool_calls(self) -> None:
        model = ToolCallingOpenAICompatibleChatModel(api_key="test-key", model_name="test-model")

        result = model._generate([HumanMessage(content="hi")])

        message = result.generations[0].message
        self.assertEqual(message.tool_calls[0]["name"], "write_todos")
        self.assertEqual(message.tool_calls[0]["args"], {"todos": []})

    def test_parse_stream_line_preserves_tool_call_chunks(self) -> None:
        from quantagent.agent.models.openai_compatible import _parse_stream_line

        chunk = _parse_stream_line(
            b'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"write_todos","arguments":"{\\"todos\\":[]}"}}]}}]}\n'
        )

        self.assertIsNotNone(chunk)
        self.assertEqual(chunk.tool_call_chunks[0]["name"], "write_todos")
        self.assertEqual(chunk.tool_call_chunks[0]["args"], '{"todos":[]}')

    def test_parse_stream_line_preserves_reasoning_content(self) -> None:
        from quantagent.agent.models.openai_compatible import _parse_stream_line

        chunk = _parse_stream_line(
            'data: {"choices":[{"delta":{"reasoning_content":"先判断是否需要检索。"}}]}\n'.encode()
        )

        self.assertIsNotNone(chunk)
        self.assertEqual(chunk.content, "")
        self.assertEqual(chunk.additional_kwargs["reasoning_content"], "先判断是否需要检索。")

    def test_completion_payload_serializes_ai_tool_calls(self) -> None:
        model = OpenAICompatibleChatModel(api_key="test-key", model_name="test-model")

        payload = model._completion_payload(
            [
                HumanMessage(content="hi"),
                AIMessage(content="", tool_calls=[{"id": "call_1", "name": "write_todos", "args": {"todos": []}}]),
            ]
        )

        tool_calls = payload["messages"][1]["tool_calls"]
        self.assertEqual(tool_calls[0]["id"], "call_1")
        self.assertEqual(tool_calls[0]["function"]["name"], "write_todos")
        self.assertEqual(tool_calls[0]["function"]["arguments"], '{"todos": []}')

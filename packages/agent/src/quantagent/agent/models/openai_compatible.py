from __future__ import annotations

from collections.abc import Iterator, Sequence
import json
from typing import Any
from urllib import error as urllib_error
from urllib import request as urllib_request

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, AIMessageChunk, BaseMessage
from langchain_core.messages.tool import tool_call, tool_call_chunk
from langchain_core.outputs import ChatGeneration, ChatGenerationChunk, ChatResult
from langchain_core.tools import BaseTool
from pydantic import ConfigDict, Field


DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1"


class OpenAICompatibleChatModel(BaseChatModel):
    """面向 DeepAgents 的最小 OpenAI-compatible ChatModel 适配器。"""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    api_key: str = Field(repr=False)
    model_name: str
    base_url: str | None = None
    request_id: str | None = None
    timeout_seconds: float = 60.0
    temperature: float = 0.0
    bound_tools: Sequence[BaseTool] = Field(default_factory=tuple, exclude=True)

    @property
    def _llm_type(self) -> str:
        return "quantagent-openai-compatible"

    def bind_tools(
        self,
        tools: Sequence[BaseTool | dict[str, Any] | type] | None = None,
        *,
        tool_choice: str | None = None,
        **kwargs: Any,
    ) -> "OpenAICompatibleChatModel":
        supported_tools = tuple(tool for tool in tools or () if isinstance(tool, BaseTool))
        return self.model_copy(update={"bound_tools": supported_tools})

    def _generate(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: Any | None = None,
        **kwargs: Any,
    ) -> ChatResult:
        parsed = self._post_chat_completions(self._completion_payload(messages, stop=stop))
        message = _extract_assistant_message(parsed)
        return ChatResult(generations=[ChatGeneration(message=message)])

    def _stream(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: Any | None = None,
        **kwargs: Any,
    ) -> Iterator[ChatGenerationChunk]:
        payload = self._completion_payload(messages, stop=stop)
        payload["stream"] = True
        for chunk_message in self._post_chat_completion_stream(payload):
            chunk = ChatGenerationChunk(message=chunk_message)
            if run_manager is not None:
                token = chunk_message.content if isinstance(chunk_message.content, str) else ""
                run_manager.on_llm_new_token(token, chunk=chunk)
            yield chunk

    def _completion_payload(self, messages: list[BaseMessage], *, stop: list[str] | None = None) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": self.model_name,
            "messages": [_message_to_openai(message) for message in messages],
            "temperature": self.temperature,
        }
        if stop:
            payload["stop"] = stop
        tools = [_tool_to_openai(tool) for tool in self.bound_tools]
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"
        return payload

    def _post_chat_completions(self, payload: dict[str, Any]) -> dict[str, Any]:
        endpoint = f"{(self.base_url or DEFAULT_OPENAI_BASE_URL).rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        if self.request_id:
            headers["X-Request-ID"] = self.request_id
        req = urllib_request.Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with urllib_request.urlopen(req, timeout=self.timeout_seconds) as response:  # noqa: S310
                body = response.read()
        except urllib_error.HTTPError as exc:
            raise RuntimeError(f"MODEL_PROVIDER_HTTP_ERROR:{exc.code}") from exc
        except urllib_error.URLError as exc:
            raise RuntimeError("MODEL_PROVIDER_UNREACHABLE") from exc
        except TimeoutError as exc:
            raise RuntimeError("MODEL_PROVIDER_TIMEOUT") from exc

        try:
            parsed = json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise RuntimeError("MODEL_PROVIDER_RESPONSE_INVALID") from exc
        if not isinstance(parsed, dict):
            raise RuntimeError("MODEL_PROVIDER_RESPONSE_INVALID")
        return parsed

    def _post_chat_completion_stream(self, payload: dict[str, Any]) -> Iterator[AIMessageChunk]:
        endpoint = f"{(self.base_url or DEFAULT_OPENAI_BASE_URL).rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        if self.request_id:
            headers["X-Request-ID"] = self.request_id
        req = urllib_request.Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with urllib_request.urlopen(req, timeout=self.timeout_seconds) as response:  # noqa: S310
                for line in response:
                    chunk = _parse_stream_line(line)
                    if chunk is not None:
                        yield chunk
        except urllib_error.HTTPError as exc:
            raise RuntimeError(f"MODEL_PROVIDER_HTTP_ERROR:{exc.code}") from exc
        except urllib_error.URLError as exc:
            raise RuntimeError("MODEL_PROVIDER_UNREACHABLE") from exc
        except TimeoutError as exc:
            raise RuntimeError("MODEL_PROVIDER_TIMEOUT") from exc


def _message_to_openai(message: BaseMessage) -> dict[str, Any]:
    role = "user"
    if message.type == "ai":
        role = "assistant"
    elif message.type == "system":
        role = "system"
    elif message.type == "tool":
        role = "tool"
    content = message.content
    if not isinstance(content, str):
        content = json.dumps(content, ensure_ascii=False)
    payload: dict[str, Any] = {"role": role, "content": content}
    tool_call_id = getattr(message, "tool_call_id", None)
    if tool_call_id:
        payload["tool_call_id"] = tool_call_id
    if message.type == "ai":
        tool_calls = _serialize_tool_calls(getattr(message, "tool_calls", None))
        if tool_calls:
            payload["tool_calls"] = tool_calls
    return payload


def _tool_to_openai(tool: BaseTool) -> dict[str, Any]:
    schema = tool.args_schema.model_json_schema() if tool.args_schema is not None else {"type": "object", "properties": {}}
    return {
        "type": "function",
        "function": {
            "name": tool.name,
            "description": tool.description or tool.name,
            "parameters": schema,
        },
    }


def _extract_assistant_message(parsed: dict[str, Any]) -> AIMessage:
    choices = parsed.get("choices")
    if not isinstance(choices, list) or not choices:
        raise RuntimeError("MODEL_PROVIDER_RESPONSE_INVALID")
    first = choices[0]
    if not isinstance(first, dict):
        raise RuntimeError("MODEL_PROVIDER_RESPONSE_INVALID")
    message = first.get("message")
    if not isinstance(message, dict):
        raise RuntimeError("MODEL_PROVIDER_RESPONSE_INVALID")
    content = message.get("content")
    tool_calls = _parse_response_tool_calls(message.get("tool_calls"))
    return AIMessage(content=content if isinstance(content, str) else "", tool_calls=tool_calls)


def _parse_stream_line(line: bytes) -> AIMessageChunk | None:
    try:
        decoded = line.decode("utf-8").strip()
    except UnicodeDecodeError as exc:
        raise RuntimeError("MODEL_PROVIDER_RESPONSE_INVALID") from exc
    if not decoded.startswith("data:"):
        return None
    data = decoded.removeprefix("data:").strip()
    if not data or data == "[DONE]":
        return None
    try:
        parsed = json.loads(data)
    except json.JSONDecodeError as exc:
        raise RuntimeError("MODEL_PROVIDER_RESPONSE_INVALID") from exc
    choices = parsed.get("choices")
    if not isinstance(choices, list) or not choices:
        return None
    first = choices[0]
    if not isinstance(first, dict):
        return None
    delta = first.get("delta")
    if not isinstance(delta, dict):
        return None
    content = delta.get("content")
    tool_call_chunks = _parse_delta_tool_call_chunks(delta.get("tool_calls"))
    additional_kwargs = _delta_additional_kwargs(delta)
    if isinstance(content, str) and content:
        return AIMessageChunk(content=content, tool_call_chunks=tool_call_chunks, additional_kwargs=additional_kwargs)
    if tool_call_chunks or additional_kwargs:
        return AIMessageChunk(content="", tool_call_chunks=tool_call_chunks, additional_kwargs=additional_kwargs)
    return None


def _delta_additional_kwargs(delta: dict[str, Any]) -> dict[str, Any]:
    # 中文注释：兼容 OpenAI-compatible 推理模型的非标准增量字段，避免 reasoning 在 provider 适配层被吃掉。
    preserved: dict[str, Any] = {}
    for key in ("reasoning", "reasoning_content", "thinking", "thought"):
        value = delta.get(key)
        if isinstance(value, str) and value:
            preserved[key] = value
    return preserved


def _parse_response_tool_calls(raw_tool_calls: object) -> list[dict[str, Any]]:
    if not isinstance(raw_tool_calls, list):
        return []
    parsed: list[dict[str, Any]] = []
    for raw_call in raw_tool_calls:
        if not isinstance(raw_call, dict):
            continue
        function = raw_call.get("function")
        if not isinstance(function, dict):
            continue
        name = function.get("name")
        if not isinstance(name, str) or not name:
            continue
        parsed.append(tool_call(name=name, args=_parse_tool_args(function.get("arguments")), id=_tool_call_id(raw_call)))
    return parsed


def _parse_delta_tool_call_chunks(raw_tool_calls: object) -> list[dict[str, Any]]:
    if not isinstance(raw_tool_calls, list):
        return []
    parsed: list[dict[str, Any]] = []
    for raw_call in raw_tool_calls:
        if not isinstance(raw_call, dict):
            continue
        function = raw_call.get("function")
        if not isinstance(function, dict):
            function = {}
        index = raw_call.get("index")
        parsed.append(
            tool_call_chunk(
                name=function.get("name") if isinstance(function.get("name"), str) else None,
                args=function.get("arguments") if isinstance(function.get("arguments"), str) else None,
                id=_tool_call_id(raw_call),
                index=index if isinstance(index, int) else None,
            )
        )
    return parsed


def _parse_tool_args(arguments: object) -> dict[str, Any]:
    if not isinstance(arguments, str) or not arguments:
        return {}
    try:
        parsed = json.loads(arguments)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _tool_call_id(raw_call: dict[str, Any]) -> str | None:
    call_id = raw_call.get("id")
    return call_id if isinstance(call_id, str) and call_id else None


def _serialize_tool_calls(raw_tool_calls: object) -> list[dict[str, Any]]:
    if not isinstance(raw_tool_calls, list):
        return []
    serialized: list[dict[str, Any]] = []
    for index, raw_call in enumerate(raw_tool_calls):
        if not isinstance(raw_call, dict):
            continue
        name = raw_call.get("name")
        if not isinstance(name, str) or not name:
            continue
        call_id = raw_call.get("id")
        if not isinstance(call_id, str) or not call_id:
            call_id = f"call_{index}"
        serialized.append(
            {
                "id": call_id,
                "type": "function",
                "function": {
                    "name": name,
                    "arguments": json.dumps(raw_call.get("args") if isinstance(raw_call.get("args"), dict) else {}, ensure_ascii=False),
                },
            }
        )
    return serialized

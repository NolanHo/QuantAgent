from __future__ import annotations

import json
from collections.abc import Mapping
from typing import Any

from quantagent.agent.streaming.events import AgentRunEvent, AgentRunEventType


class EventSequencer:
    def __init__(self) -> None:
        self._seq = 0

    def next(
        self,
        *,
        agent_run_id: str,
        trace_id: str,
        event_type: AgentRunEventType,
        payload: Mapping[str, Any] | None = None,
        content: str | None = None,
    ) -> AgentRunEvent:
        self._seq += 1
        return AgentRunEvent(
            agent_run_id=agent_run_id,
            trace_id=trace_id,
            type=event_type,
            seq=self._seq,
            payload=dict(payload or {}),
            content=content,
        )


def chunk_to_message_text(chunk: object) -> str:
    """DeepAgents chunk 格式会随版本变化；优先提取原始 assistant 文本，未知形态保留结构说明。"""

    summary = chunk_to_message_summary(chunk)
    if summary:
        return summary

    if isinstance(chunk, str):
        return f"deepagents string chunk length={len(chunk)}"
    if isinstance(chunk, Mapping):
        key_summary = ", ".join(str(key) for key in chunk.keys())
        return f"deepagents mapping chunk keys=[{key_summary}]"
    return type(chunk).__name__


def chunk_to_message_summary(chunk: object) -> str | None:
    """只提取适合进入 chat 主流的 assistant 文本；结构 chunk 交给 runtime 映射。"""

    content = _extract_message_content(chunk)
    if content:
        return content
    return None


def iter_deepagents_stream_events(chunk: object) -> list[tuple[AgentRunEventType, dict[str, Any], str | None]]:
    """把 DeepAgents stream chunk 映射成平台事件，隔离版本差异和未知结构。"""

    namespace, mode, value = _split_stream_chunk(chunk)
    scope_payload = _scope_payload(namespace)
    if mode == "messages":
        events: list[tuple[AgentRunEventType, dict[str, Any], str | None]] = []
        for tool_call in _extract_tool_call_chunks(value):
            event = _tool_call_to_started_event(tool_call, source="messages")
            if event is not None:
                events.append(_with_scope(event, scope_payload))
        for tool_message in _extract_tool_messages(value):
            events.append(_with_scope(_tool_message_to_completed_event(tool_message, source="messages"), scope_payload))
        reasoning = _extract_reasoning_content(value)
        if reasoning:
            events.append(
                _with_scope(
                    (
                        AgentRunEventType.MODEL_REASONING,
                        {"reasoning": reasoning, "raw": _json_safe(value), "source": "messages"},
                        reasoning,
                    ),
                    scope_payload,
                )
            )
        summary = _extract_assistant_message_content(value)
        if summary:
            events.append(
                _with_scope(
                    (
                        AgentRunEventType.MODEL_DELTA,
                        {"delta": summary, "role": "assistant", "source": "messages"},
                        summary,
                    ),
                    scope_payload,
                )
            )
        return events

    if mode == "updates":
        return [_with_scope(event, scope_payload) for event in _updates_to_events(value)]

    reasoning = _extract_reasoning_content(value)
    if reasoning:
        return [
            _with_scope(
                (
                    AgentRunEventType.MODEL_REASONING,
                    {"reasoning": reasoning, "raw": _json_safe(value), "source": "default"},
                    reasoning,
                ),
                scope_payload,
            )
        ]
    summary = chunk_to_message_summary(value)
    if summary:
        return [
            _with_scope(
                (
                    AgentRunEventType.MODEL_DELTA,
                    {"delta": summary, "role": "assistant", "source": "default"},
                    summary,
                ),
                scope_payload,
            )
        ]
    return [_with_scope(event, scope_payload) for event in _updates_to_events(value)]


def _split_stream_chunk(chunk: object) -> tuple[tuple[str, ...], str | None, object]:
    if isinstance(chunk, tuple) and len(chunk) == 3 and isinstance(chunk[0], tuple) and isinstance(chunk[1], str):
        return tuple(str(item) for item in chunk[0]), chunk[1], chunk[2]
    if isinstance(chunk, tuple) and len(chunk) == 2 and isinstance(chunk[0], tuple):
        namespace = tuple(str(item) for item in chunk[0])
        mode, value = _split_stream_mode(chunk[1])
        return namespace, mode, value
    mode, value = _split_stream_mode(chunk)
    return (), mode, value


def _split_stream_mode(chunk: object) -> tuple[str | None, object]:
    if isinstance(chunk, tuple) and len(chunk) == 2 and isinstance(chunk[0], str):
        return chunk[0], chunk[1]
    return None, chunk


def _scope_payload(namespace: tuple[str, ...]) -> dict[str, Any]:
    if not namespace:
        return {"actor_type": "main"}
    payload: dict[str, Any] = {
        "actor_type": "main",
        "graph_namespace": list(namespace),
        "subgraph": True,
    }
    subagent_name = _subagent_name_from_namespace(namespace)
    if subagent_name:
        payload["actor_type"] = "subagent"
        payload["subagent_name"] = subagent_name
    return payload


def _subagent_name_from_namespace(namespace: tuple[str, ...]) -> str | None:
    for item in namespace:
        name = item.split(":", 1)[0]
        if name and name not in {"agent", "model", "tools", "tool"}:
            return name
    return None


def _with_scope(
    event: tuple[AgentRunEventType, dict[str, Any], str | None],
    scope_payload: Mapping[str, Any],
) -> tuple[AgentRunEventType, dict[str, Any], str | None]:
    if not scope_payload:
        return event
    event_type, payload, summary = event
    return event_type, {**payload, **scope_payload}, summary


def _updates_to_events(value: object) -> list[tuple[AgentRunEventType, dict[str, Any], str | None]]:
    events: list[tuple[AgentRunEventType, dict[str, Any], str | None]] = []
    normalized = _json_safe(value)
    # 中文注释：updates 通道通常是 DeepAgents/LangGraph 状态快照，里面可能重复包含
    # 已经通过 messages 通道流出的累计 reasoning；主 COT 只消费 messages 增量，避免重复拼接。
    todos = _find_key(value, "todos")
    if todos is not None:
        safe_todos = _json_safe(todos)
        events.append((AgentRunEventType.TODO_UPDATED, {"todos": safe_todos, "source": "updates"}, "Todo updated."))

    messages = _find_key(value, "messages")
    if messages is not None:
        tool_messages = _extract_tool_messages(messages)
        for tool_message in tool_messages:
            events.append(_tool_message_to_completed_event(tool_message, source="updates"))

    for tool_call in _extract_tool_call_chunks(value):
        event = _tool_call_to_started_event(tool_call, source="updates")
        if event is not None:
            events.append(event)

    subagents = _find_key(value, "subagents")
    if subagents is not None:
        events.append(
            (
                AgentRunEventType.SUBAGENT_COMPLETED,
                {"subagents": _json_safe(subagents), "source": "updates"},
                "SubAgent updated.",
            )
        )

    artifacts = _find_key(value, "artifacts") or _find_key(value, "files")
    if artifacts is not None:
        events.append(
            (
                AgentRunEventType.ARTIFACT_CREATED,
                {"artifacts": _json_safe(artifacts), "source": "updates"},
                "Artifact updated.",
            )
        )

    interrupts = _find_key(value, "__interrupt__") or _find_key(value, "interrupts")
    if interrupts is not None:
        events.append(
            (
                AgentRunEventType.INTERRUPT_REQUESTED,
                {"interrupts": _json_safe(interrupts), "source": "updates"},
                "Human approval requested.",
            )
        )

    if events:
        return events

    final_summary = chunk_to_message_summary(value)
    if final_summary:
        return [(AgentRunEventType.RUN_OUTPUT, {"source": "updates"}, final_summary)]
    if isinstance(normalized, dict) and normalized:
        return [
            (
                AgentRunEventType.RUNTIME_EVENT,
                {"raw": normalized, "source": "updates"},
                "DeepAgents runtime event.",
            )
        ]
    return []


def _find_key(value: object, key: str) -> object | None:
    if isinstance(value, Mapping):
        if key in value:
            return value[key]
        for item in value.values():
            found = _find_key(item, key)
            if found is not None:
                return found
    if isinstance(value, list | tuple):
        for item in value:
            found = _find_key(item, key)
            if found is not None:
                return found
    return None


def _extract_tool_messages(messages: object) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    if isinstance(messages, Mapping):
        for item in messages.values():
            result.extend(_extract_tool_messages(item))
        return result
    if not isinstance(messages, list | tuple):
        message_type = getattr(messages, "type", None)
        if message_type == "tool":
            result.append(_json_safe(messages))
        return result
    for message in messages:
        message_type = getattr(message, "type", None)
        if message_type == "tool":
            result.append(_json_safe(message))
            continue
        if isinstance(message, Mapping | list | tuple):
            result.extend(_extract_tool_messages(message))
    return result


def _json_safe(value: object) -> Any:
    if isinstance(value, Mapping):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, list | tuple):
        return [_json_safe(item) for item in value]
    content = getattr(value, "content", None)
    if content is not None:
        payload: dict[str, Any] = {"type": str(getattr(value, "type", type(value).__name__))}
        if isinstance(content, str):
            payload["content"] = content
        else:
            payload["content"] = _json_safe(content)
        name = getattr(value, "name", None)
        if name:
            payload["name"] = str(name)
        tool_call_id = getattr(value, "tool_call_id", None)
        if tool_call_id:
            payload["tool_call_id"] = str(tool_call_id)
        additional_kwargs = getattr(value, "additional_kwargs", None)
        if isinstance(additional_kwargs, Mapping) and additional_kwargs:
            payload["additional_kwargs"] = _json_safe(additional_kwargs)
        tool_call_chunks = getattr(value, "tool_call_chunks", None)
        if tool_call_chunks:
            payload["tool_call_chunks"] = _json_safe(tool_call_chunks)
        tool_calls = getattr(value, "tool_calls", None)
        if tool_calls:
            payload["tool_calls"] = _json_safe(tool_calls)
        return payload
    if isinstance(value, str | int | float | bool) or value is None:
        return value
    return type(value).__name__


def _extract_message_content(value: object) -> str | None:
    if isinstance(value, Mapping):
        for key in ("messages", "message"):
            content = _extract_message_content(value.get(key))
            if content:
                return content
        model_value = value.get("model")
        if model_value is not None:
            content = _extract_message_content(model_value)
            if content:
                return content
        for item in value.values():
            content = _extract_message_content(item)
            if content:
                return content
        return None

    if isinstance(value, list | tuple):
        for item in reversed(value):
            content = _extract_message_content(item)
            if content:
                return content
        return None

    content = getattr(value, "content", None)
    if isinstance(content, str) and content.strip():
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, Mapping) and isinstance(item.get("text"), str):
                parts.append(item["text"])
        joined = "".join(parts).strip()
        return joined or None
    return None


def _extract_assistant_message_content(value: object) -> str | None:
    if isinstance(value, Mapping):
        for key in ("messages", "message"):
            content = _extract_assistant_message_content(value.get(key))
            if content:
                return content
        model_value = value.get("model")
        if model_value is not None:
            content = _extract_assistant_message_content(model_value)
            if content:
                return content
        for item in value.values():
            content = _extract_assistant_message_content(item)
            if content:
                return content
        return None

    if isinstance(value, list | tuple):
        for item in reversed(value):
            content = _extract_assistant_message_content(item)
            if content:
                return content
        return None

    message_type = getattr(value, "type", None)
    if message_type not in {"ai", "AIMessageChunk"}:
        return None
    return _extract_message_content(value)


def _extract_reasoning_content(value: object) -> str | None:
    if isinstance(value, Mapping):
        for key in ("reasoning", "reasoning_content", "thinking", "thought"):
            item = value.get(key)
            if isinstance(item, str) and item.strip():
                return item
        additional = value.get("additional_kwargs")
        if additional is not None:
            content = _extract_reasoning_content(additional)
            if content:
                return content
        for item in value.values():
            content = _extract_reasoning_content(item)
            if content:
                return content
        return None

    if isinstance(value, list | tuple):
        for item in value:
            content = _extract_reasoning_content(item)
            if content:
                return content
        return None

    additional_kwargs = getattr(value, "additional_kwargs", None)
    if isinstance(additional_kwargs, Mapping):
        content = _extract_reasoning_content(additional_kwargs)
        if content:
            return content
    response_metadata = getattr(value, "response_metadata", None)
    if isinstance(response_metadata, Mapping):
        content = _extract_reasoning_content(response_metadata)
        if content:
            return content
    return None


def _extract_tool_call_chunks(value: object) -> list[Any]:
    chunks: list[Any] = []
    if isinstance(value, Mapping):
        raw = value.get("tool_call_chunks") or value.get("tool_calls")
        if raw:
            safe = _json_safe(raw)
            return safe if isinstance(safe, list) else [safe]
        for item in value.values():
            chunks.extend(_extract_tool_call_chunks(item))
        return chunks

    if isinstance(value, list | tuple):
        for item in value:
            chunks.extend(_extract_tool_call_chunks(item))
        return chunks

    raw = getattr(value, "tool_call_chunks", None) or getattr(value, "tool_calls", None)
    if raw:
        safe = _json_safe(raw)
        return safe if isinstance(safe, list) else [safe]
    return []


def _tool_call_to_started_event(tool_call: object, *, source: str) -> tuple[AgentRunEventType, dict[str, Any], str | None] | None:
    safe = _json_safe(tool_call)
    tool_call_record = safe if isinstance(safe, Mapping) else {"raw": safe}
    args_value = tool_call_record.get("args") or tool_call_record.get("arguments") or tool_call_record.get("input")
    parsed_input = _parse_tool_input(args_value)
    raw_args = args_value if isinstance(args_value, str) else None
    call_id = _read_non_empty_string(tool_call_record, "id", "tool_call_id", "call_id")
    name = _read_non_empty_string(tool_call_record, "name", "tool_name", "tool_id")
    if not call_id and not name:
        return None
    if isinstance(raw_args, str) and parsed_input is None:
        return None
    payload: dict[str, Any] = {
        "source": source,
        "raw": safe,
    }
    if call_id:
        payload["tool_call_id"] = call_id
        payload["call_id"] = call_id
    if name:
        payload["name"] = name
        payload["tool_name"] = name
    if parsed_input is not None:
        payload["input"] = parsed_input
        payload["args"] = parsed_input
    if raw_args is not None:
        payload["args_text"] = raw_args
    label = name or call_id or "tool"
    return (AgentRunEventType.TOOL_STARTED, payload, f"工具 {label} 开始调用。")


def _tool_message_to_completed_event(tool_message: Mapping[str, Any], *, source: str) -> tuple[AgentRunEventType, dict[str, Any], str | None]:
    content = tool_message.get("content")
    result = _parse_tool_result(content)
    call_id = _read_non_empty_string(tool_message, "tool_call_id", "id", "call_id")
    name = _read_non_empty_string(tool_message, "name", "tool_name", "tool_id")
    payload: dict[str, Any] = {
        "message": dict(tool_message),
        "result": result,
        "output": result,
        "source": source,
    }
    if call_id:
        payload["tool_call_id"] = call_id
        payload["call_id"] = call_id
    if name:
        payload["name"] = name
        payload["tool_name"] = name
    summary = content if isinstance(content, str) and content.strip() else "Tool completed."
    return (AgentRunEventType.TOOL_COMPLETED, payload, summary)


def _parse_tool_input(value: object) -> Any:
    if value is None:
        return None
    if isinstance(value, Mapping):
        return _json_safe(value)
    if isinstance(value, list | tuple):
        return _json_safe(value)
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return None
        try:
            return json.loads(stripped)
        except json.JSONDecodeError:
            return None
    return _json_safe(value)


def _parse_tool_result(value: object) -> Any:
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return ""
        try:
            return json.loads(stripped)
        except json.JSONDecodeError:
            return value
    return _json_safe(value)


def _read_non_empty_string(value: Mapping[str, Any], *keys: str) -> str | None:
    for key in keys:
        item = value.get(key)
        if isinstance(item, str) and item:
            return item
    return None

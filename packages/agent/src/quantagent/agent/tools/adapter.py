from __future__ import annotations

import asyncio
import inspect
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass
from typing import Any, Generic, Protocol, TypeVar
from uuid import uuid4

from pydantic import BaseModel

from quantagent.agent.runtime.context import ToolRuntimeContext
from quantagent.agent.streaming.adapter import EventSequencer
from quantagent.agent.streaming.events import AgentRunEvent, AgentRunEventType
from quantagent.agent.tools.profiles import ToolBinding

InputModelT = TypeVar("InputModelT", bound=BaseModel)


class PlatformToolCallable(Protocol[InputModelT]):
    def __call__(self, input_data: InputModelT, runtime_context: ToolRuntimeContext) -> Mapping[str, Any] | Awaitable[Mapping[str, Any]]: ...


@dataclass(frozen=True)
class PlatformTool(Generic[InputModelT]):
    binding: ToolBinding
    input_model: type[InputModelT]
    callable: PlatformToolCallable[InputModelT]


class ToolAdapter:
    def __init__(
        self,
        *,
        runtime_context: ToolRuntimeContext,
        sequencer: EventSequencer,
    ) -> None:
        self._runtime_context = runtime_context
        self._sequencer = sequencer

    async def invoke(self, tool: PlatformTool[InputModelT], raw_input: Mapping[str, Any]) -> tuple[Mapping[str, Any], list[AgentRunEvent]]:
        input_data, input_payload, invocation_id, events = self._start_invocation(tool, raw_input)

        try:
            result = tool.callable(input_data, self._runtime_context)
            if inspect.isawaitable(result):
                result = await result
        except Exception as exc:  # noqa: BLE001
            return self._fail_invocation(tool, input_payload, invocation_id, events, exc)

        return self._complete_invocation(tool, input_payload, invocation_id, events, result)

    def invoke_sync(self, tool: PlatformTool[InputModelT], raw_input: Mapping[str, Any]) -> tuple[Mapping[str, Any], list[AgentRunEvent]]:
        input_data, input_payload, invocation_id, events = self._start_invocation(tool, raw_input)

        try:
            result = tool.callable(input_data, self._runtime_context)
            if inspect.isawaitable(result):
                result = _run_sync(result)
        except Exception as exc:  # noqa: BLE001
            return self._fail_invocation(tool, input_payload, invocation_id, events, exc)

        return self._complete_invocation(tool, input_payload, invocation_id, events, result)

    def _start_invocation(
        self,
        tool: PlatformTool[InputModelT],
        raw_input: Mapping[str, Any],
    ) -> tuple[InputModelT, dict[str, Any], str, list[AgentRunEvent]]:
        input_data = tool.input_model.model_validate(dict(raw_input))
        input_payload = input_data.model_dump(mode="json")
        invocation_id = f"tool_inv_{uuid4().hex}"
        events = [
            self._sequencer.next(
                agent_run_id=self._runtime_context.agent_run_id,
                trace_id=self._runtime_context.trace_id,
                event_type=AgentRunEventType.TOOL_STARTED,
                payload={
                    **self._scope_payload(),
                    "invocation_id": invocation_id,
                    "tool_call_id": invocation_id,
                    "call_id": invocation_id,
                    "tool_id": tool.binding.tool_id,
                    "name": tool.binding.name,
                    "tool_name": tool.binding.name,
                    "input": input_payload,
                    "args": input_payload,
                },
                content=f"工具 {tool.binding.name} 开始调用。",
            )
        ]
        return input_data, input_payload, invocation_id, events

    def _fail_invocation(
        self,
        tool: PlatformTool[InputModelT],
        input_payload: Mapping[str, Any],
        invocation_id: str,
        events: list[AgentRunEvent],
        exc: Exception,
    ) -> tuple[Mapping[str, Any], list[AgentRunEvent]]:
        error = _tool_error_content(exc)
        events.append(
            self._sequencer.next(
                agent_run_id=self._runtime_context.agent_run_id,
                trace_id=self._runtime_context.trace_id,
                event_type=AgentRunEventType.TOOL_FAILED,
                payload={
                    **self._scope_payload(),
                    "invocation_id": invocation_id,
                    "tool_call_id": invocation_id,
                    "call_id": invocation_id,
                    "tool_id": tool.binding.tool_id,
                    "name": tool.binding.name,
                    "tool_name": tool.binding.name,
                    "input": input_payload,
                    "args": input_payload,
                    "error": str(exc),
                    "error_type": type(exc).__name__,
                },
                content=f"工具 {tool.binding.name} 调用失败。",
            )
        )
        # 中文注释：工具自身失败应作为 tool result 回给 DeepAgents，让模型有机会调整计划继续 loop；
        # 未授权、缺工具等平台配置错误仍在 Runtime 层直接失败。
        return {"ok": False, "error": error}, events

    def _complete_invocation(
        self,
        tool: PlatformTool[InputModelT],
        input_payload: Mapping[str, Any],
        invocation_id: str,
        events: list[AgentRunEvent],
        result: Mapping[str, Any],
    ) -> tuple[Mapping[str, Any], list[AgentRunEvent]]:
        events.append(
            self._sequencer.next(
                agent_run_id=self._runtime_context.agent_run_id,
                trace_id=self._runtime_context.trace_id,
                event_type=AgentRunEventType.TOOL_COMPLETED,
                payload={
                    **self._scope_payload(),
                    "invocation_id": invocation_id,
                    "tool_call_id": invocation_id,
                    "call_id": invocation_id,
                    "tool_id": tool.binding.tool_id,
                    "name": tool.binding.name,
                    "tool_name": tool.binding.name,
                    "input": input_payload,
                    "args": input_payload,
                    "result": dict(result),
                    "output": dict(result),
                },
                content=f"工具 {tool.binding.name} 调用完成。",
            )
        )
        return dict(result), events

    def _scope_payload(self) -> dict[str, str]:
        payload: dict[str, str] = {"actor_type": "main"}
        if self._runtime_context.subagent_id:
            payload["actor_type"] = "subagent"
            payload["subagent_id"] = self._runtime_context.subagent_id
        if self._runtime_context.subagent_name:
            payload["subagent_name"] = self._runtime_context.subagent_name
        return payload


def _tool_error_content(exc: Exception) -> str:
    message = str(exc)
    return f"{type(exc).__name__}: {message}" if message else type(exc).__name__


def _run_sync(awaitable: Awaitable[Mapping[str, Any]]) -> Mapping[str, Any]:
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(awaitable)
    # 中文注释：DeepAgents 正常应走 async tool path；如果框架在已有事件循环内同步调工具，
    # 继续阻塞等待会死锁，因此把失败作为工具结果交回模型而不是让 Runtime 崩掉。
    close = getattr(awaitable, "close", None)
    if callable(close):
        close()
    raise RuntimeError("当前事件循环内不可执行同步工具调用")

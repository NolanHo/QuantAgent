from __future__ import annotations

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
        input_data = tool.input_model.model_validate(dict(raw_input))
        input_payload = input_data.model_dump(mode="json")
        invocation_id = f"tool_inv_{uuid4().hex}"
        events = [
            self._sequencer.next(
                agent_run_id=self._runtime_context.agent_run_id,
                trace_id=self._runtime_context.trace_id,
                event_type=AgentRunEventType.TOOL_STARTED,
                payload={
                    "invocation_id": invocation_id,
                    "tool_call_id": invocation_id,
                    "call_id": invocation_id,
                    "tool_id": tool.binding.tool_id,
                    "name": tool.binding.name,
                    "tool_name": tool.binding.name,
                    "input": input_payload,
                    "args": input_payload,
                },
                content=f"Tool {tool.binding.name} started.",
            )
        ]

        try:
            result = tool.callable(input_data, self._runtime_context)
            if inspect.isawaitable(result):
                result = await result
        except Exception as exc:  # noqa: BLE001
            error = _tool_error_content(exc)
            events.append(
                self._sequencer.next(
                    agent_run_id=self._runtime_context.agent_run_id,
                    trace_id=self._runtime_context.trace_id,
                    event_type=AgentRunEventType.TOOL_FAILED,
                    payload={
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
                    content=f"Tool {tool.binding.name} failed.",
                )
            )
            # 中文注释：工具自身失败应作为 tool result 回给 DeepAgents，让模型有机会调整计划继续 loop；
            # 未授权、缺工具等平台配置错误仍在 Runtime 层直接失败。
            return {"ok": False, "error": error}, events

        events.append(
            self._sequencer.next(
                agent_run_id=self._runtime_context.agent_run_id,
                trace_id=self._runtime_context.trace_id,
                event_type=AgentRunEventType.TOOL_COMPLETED,
                payload={
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
                content=f"Tool {tool.binding.name} completed.",
            )
        )
        return dict(result), events


def _tool_error_content(exc: Exception) -> str:
    message = str(exc)
    return f"{type(exc).__name__}: {message}" if message else type(exc).__name__

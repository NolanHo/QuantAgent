from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


AGENT_RUNTIME_EVENT_SCHEMA_VERSION = "agent-runtime-event.v1"


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AgentRuntimeActor(StrictModel):
    type: Literal["main_agent", "subagent", "tool", "runtime"]
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    display_name: str = Field(min_length=1)


class AgentRuntimeSpan(StrictModel):
    span_id: str = Field(min_length=1)
    parent_span_id: str | None = None
    kind: Literal["main_run", "subagent_run", "tool_call", "runtime"]


class AgentRuntimeRender(StrictModel):
    lane: Literal["main", "subagent", "runtime"]
    group_id: str = Field(min_length=1)
    target: Literal["cot", "final", "side_panel"]
    content_kind: Literal["reasoning", "message", "tool", "todo", "artifact", "notice"]


class AgentRuntimeContent(StrictModel):
    format: Literal["markdown", "text", "json"]
    text: str | None = None
    json: Any | None = None
    delta_mode: Literal["append", "snapshot"] | None = None


class AgentRuntimeTool(StrictModel):
    call_id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    input: Any | None = None
    output: Any | None = None
    error: dict[str, str] | None = None


class AgentRuntimeSubagent(StrictModel):
    subagent_id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    task_call_id: str = Field(min_length=1)
    input: str | None = None
    output: str | None = None


class AgentRuntimeEventV1(StrictModel):
    schema_version: Literal["agent-runtime-event.v1"] = AGENT_RUNTIME_EVENT_SCHEMA_VERSION
    event_id: str = Field(min_length=1)
    session_id: str = Field(min_length=1)
    thread_id: str = Field(min_length=1)
    workspace_id: str = Field(min_length=1)
    agent_run_id: str = Field(min_length=1)
    seq: int = Field(ge=1)
    event_type: Literal[
        "run.started",
        "run.completed",
        "run.failed",
        "agent.reasoning.delta",
        "agent.message.delta",
        "agent.message.final",
        "todo.updated",
        "tool.started",
        "tool.completed",
        "tool.failed",
        "subagent.started",
        "subagent.completed",
        "artifact.created",
        "interrupt.requested",
        "runtime.raw",
    ]
    actor: AgentRuntimeActor
    span: AgentRuntimeSpan
    render: AgentRuntimeRender
    content: AgentRuntimeContent | None = None
    tool: AgentRuntimeTool | None = None
    subagent: AgentRuntimeSubagent | None = None
    raw: Any | None = None

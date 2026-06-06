from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AgentChatCreateSessionRequest(StrictModel):
    industry_id: str = Field(default="quantagent.default.industry.general", min_length=1)
    agent_id: str = Field(default="quantagent.default.agent.chat", min_length=1)
    title: str | None = Field(default=None, max_length=240)
    debug_preset: str | None = Field(default=None, max_length=80)


class AgentChatStreamRequest(StrictModel):
    message: str = Field(min_length=1, max_length=8000)


class AgentChatMessageResponse(StrictModel):
    message_id: str
    session_id: str
    run_id: str | None = None
    seq: int
    role: str
    kind: str
    content: str
    payload: dict[str, Any] = Field(default_factory=dict)
    runtime_event: dict[str, Any] | None = None
    created_at: datetime


class AgentChatSessionResponse(StrictModel):
    session_id: str
    thread_id: str
    workspace_id: str
    industry_id: str
    agent_id: str
    title: str | None = None
    status: str
    messages: list[AgentChatMessageResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


AgentChatStreamEventType = Literal[
    "message.appended",
    "run.started",
    "model.delta",
    "model.reasoning",
    "todo.updated",
    "tool.started",
    "tool.completed",
    "tool.failed",
    "subagent.started",
    "subagent.completed",
    "artifact.created",
    "interrupt.requested",
    "run.output",
    "run.failed",
    "run.completed",
    "runtime.event",
]


class AgentChatStreamEvent(StrictModel):
    event_id: str
    type: AgentChatStreamEventType | str
    session_id: str
    run_id: str | None = None
    agent_run_id: str | None = None
    seq: int | None = None
    role: str | None = None
    kind: str
    content: str = ""
    payload: dict[str, Any] = Field(default_factory=dict)
    runtime_event: dict[str, Any] | None = None
    trace_id: str | None = None
    created_at: datetime

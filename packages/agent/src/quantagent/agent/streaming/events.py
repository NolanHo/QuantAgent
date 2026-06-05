from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AgentRunEventType(StrEnum):
    RUN_STARTED = "run.started"
    MODEL_DELTA = "model.delta"
    MODEL_REASONING = "model.reasoning"
    TODO_UPDATED = "todo.updated"
    TOOL_STARTED = "tool.started"
    TOOL_COMPLETED = "tool.completed"
    TOOL_FAILED = "tool.failed"
    SUBAGENT_STARTED = "subagent.started"
    SUBAGENT_COMPLETED = "subagent.completed"
    ARTIFACT_CREATED = "artifact.created"
    INTERRUPT_REQUESTED = "interrupt.requested"
    RUN_OUTPUT = "run.output"
    RUN_FAILED = "run.failed"
    RUN_COMPLETED = "run.completed"
    RUNTIME_EVENT = "runtime.event"


class AgentRunEvent(StrictModel):
    event_id: str = Field(default_factory=lambda: f"agent_evt_{uuid4().hex}", description="Runtime event id.")
    agent_run_id: str = Field(description="AgentRun id.")
    type: AgentRunEventType = Field(description="Stable event type.")
    seq: int = Field(ge=1, description="Monotonic sequence within the run.")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), description="Event creation time.")
    payload: dict[str, Any] = Field(default_factory=dict, description="Structured runtime payload.")
    content: str | None = Field(default=None, description="Raw display content emitted by the runtime event.")
    trace_id: str = Field(description="Trace id spanning runtime, tools, audit, and logs.")

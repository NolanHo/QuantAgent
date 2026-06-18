import type { AgentChatMessageResponse, AgentChatSessionResponse, AgentChatStreamEvent } from "../api";
import type { AgentRuntimeEventV1 } from "../api/agent-chat.contracts";
import type { AgentChatDisplayMessage, AgentChatState } from "../types";

export function createInitialAgentChatState(): AgentChatState {
  return {
    errorSummary: null,
    messages: [],
    sessionId: null,
    status: "idle",
    traceId: null,
  };
}

export function stateFromSession(session: AgentChatSessionResponse): AgentChatState {
  return {
    ...createInitialAgentChatState(),
    messages: session.messages.map(messageFromResponse),
    sessionId: session.session_id,
  };
}

export function applyAgentChatStreamEvent(state: AgentChatState, event: AgentChatStreamEvent): AgentChatState {
  const message = messageFromEvent(event);
  const status = event.type === "run.failed" ? "failed" : event.type === "run.completed" ? "completed" : "streaming";
  return {
    ...state,
    errorSummary: event.type === "run.failed" ? event.content : state.errorSummary,
    messages: mergeMessage(state.messages, message),
    sessionId: event.session_id,
    status,
    traceId: event.trace_id ?? state.traceId,
  };
}

export function markAgentChatAborted(state: AgentChatState): AgentChatState {
  if (state.status !== "streaming") return state;
  return { ...state, status: "aborted" };
}

function messageFromResponse(message: AgentChatMessageResponse): AgentChatDisplayMessage {
  return {
    content: message.content,
    createdAt: message.created_at,
    id: message.message_id,
    kind: message.kind,
    payload: message.payload,
    role: message.role,
    runId: message.run_id,
    runtimeEvent: message.runtime_event ?? readRuntimeEventFromPayload(message.payload),
    seq: message.seq,
  };
}

function messageFromEvent(event: AgentChatStreamEvent): AgentChatDisplayMessage {
  return {
    content: event.content,
    createdAt: event.created_at,
    id: event.event_id,
    kind: event.kind,
    payload: event.payload,
    role: event.role ?? "assistant",
    runId: event.run_id,
    runtimeEvent: event.runtime_event ?? readRuntimeEventFromPayload(event.payload),
    seq: event.seq ?? Number.MAX_SAFE_INTEGER,
    traceId: event.trace_id,
  };
}

function readRuntimeEventFromPayload(payload: Record<string, unknown>): AgentRuntimeEventV1 | null {
  const value = payload.runtime_event;
  if (value && typeof value === "object" && "schema_version" in value && value.schema_version === "agent-runtime-event.v1") {
    return value as AgentRuntimeEventV1;
  }
  return null;
}

function mergeMessage(messages: AgentChatDisplayMessage[], message: AgentChatDisplayMessage): AgentChatDisplayMessage[] {
  return [...messages.filter((item) => item.id !== message.id), message].sort((left, right) => left.seq - right.seq);
}

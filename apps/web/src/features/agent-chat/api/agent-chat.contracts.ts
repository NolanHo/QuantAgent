export interface AgentChatCreateSessionRequest {
  agent_id?: string;
  debug_preset?: string | null;
  industry_id?: string;
  title?: string | null;
}

export interface AgentChatStreamRequest {
  message: string;
}

export type AgentRuntimeEventTypeV1 =
  | "run.started"
  | "run.completed"
  | "run.failed"
  | "agent.reasoning.delta"
  | "agent.message.delta"
  | "agent.message.final"
  | "todo.updated"
  | "tool.started"
  | "tool.completed"
  | "tool.failed"
  | "subagent.started"
  | "subagent.completed"
  | "artifact.created"
  | "interrupt.requested"
  | "runtime.raw";

export interface AgentRuntimeActorV1 {
  type: "main_agent" | "runtime" | "subagent" | "tool";
  id: string;
  name: string;
  display_name: string;
}

export interface AgentRuntimeSpanV1 {
  span_id: string;
  parent_span_id: null | string;
  kind: "main_run" | "runtime" | "subagent_run" | "tool_call";
}

export interface AgentRuntimeRenderV1 {
  lane: "main" | "runtime" | "subagent";
  group_id: string;
  target: "cot" | "final" | "side_panel";
  content_kind: "artifact" | "message" | "notice" | "reasoning" | "todo" | "tool";
}

export interface AgentRuntimeContentV1 {
  format: "json" | "markdown" | "text";
  text?: null | string;
  json?: unknown;
  delta_mode?: "append" | "snapshot" | null;
}

export interface AgentRuntimeToolV1 {
  call_id: string;
  name: string;
  input?: unknown;
  output?: unknown;
  error?: null | {
    type: string;
    message: string;
  };
}

export interface AgentRuntimeSubagentV1 {
  subagent_id: string;
  name: string;
  task_call_id: string;
  input?: null | string;
  output?: null | string;
}

export interface AgentRuntimeEventV1 {
  schema_version: "agent-runtime-event.v1";
  event_id: string;
  session_id: string;
  thread_id: string;
  workspace_id: string;
  agent_run_id: string;
  seq: number;
  event_type: AgentRuntimeEventTypeV1;
  actor: AgentRuntimeActorV1;
  span: AgentRuntimeSpanV1;
  render: AgentRuntimeRenderV1;
  content?: AgentRuntimeContentV1 | null;
  tool?: AgentRuntimeToolV1 | null;
  subagent?: AgentRuntimeSubagentV1 | null;
  raw?: unknown;
}

export interface AgentChatMessageResponse {
  message_id: string;
  session_id: string;
  run_id: string | null;
  seq: number;
  role: string;
  kind: string;
  content: string;
  payload: Record<string, unknown>;
  runtime_event?: AgentRuntimeEventV1 | null;
  created_at: string;
}

export interface AgentChatSessionResponse {
  session_id: string;
  thread_id: string;
  workspace_id: string;
  industry_id: string;
  agent_id: string;
  title: string | null;
  status: string;
  messages: AgentChatMessageResponse[];
  created_at: string;
  updated_at: string;
}

export interface AgentChatStreamEvent {
  event_id: string;
  type: string;
  session_id: string;
  run_id: string | null;
  agent_run_id: string | null;
  seq: number | null;
  role: string | null;
  kind: string;
  content: string;
  payload: Record<string, unknown>;
  runtime_event?: AgentRuntimeEventV1 | null;
  trace_id: string | null;
  created_at: string;
}

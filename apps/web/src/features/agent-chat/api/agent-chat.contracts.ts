export interface AgentChatCreateSessionRequest {
  agent_id?: string;
  industry_id?: string;
  title?: string | null;
}

export interface AgentChatStreamRequest {
  message: string;
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
  trace_id: string | null;
  created_at: string;
}


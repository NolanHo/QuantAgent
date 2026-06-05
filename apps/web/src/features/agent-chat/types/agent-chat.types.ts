export type AgentChatStatus = "idle" | "loading" | "streaming" | "completed" | "failed" | "aborted";

export interface AgentChatTimelineItem {
  agentRunId?: null | string;
  content: string;
  createdAt: string;
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  role: string;
  runId: null | string;
  seq: number;
  traceId?: null | string;
  type?: string;
}

export type AgentChatDisplayMessage = AgentChatTimelineItem;

export interface AgentChatState {
  errorSummary: null | string;
  messages: AgentChatTimelineItem[];
  sessionId: null | string;
  status: AgentChatStatus;
  traceId: null | string;
}

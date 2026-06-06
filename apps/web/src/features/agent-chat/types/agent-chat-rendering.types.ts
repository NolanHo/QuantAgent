export type AgentRenderRole = "assistant" | "system" | "tool" | "user";

export type AgentRenderTone = "info" | "success" | "warning" | "danger" | "neutral";

export interface AgentRenderMessage {
  id: string;
  createdAt: string;
  role: AgentRenderRole;
  title?: string;
  meta?: string;
  parts: AgentRenderPart[];
}

export type AgentRenderPart =
  | AgentArtifactPart
  | AgentDecisionPart
  | AgentNoticePart
  | AgentReasoningPart
  | AgentSourcesPart
  | AgentSubagentPart
  | AgentTaskListPart
  | AgentTextPart
  | AgentToolPart;

export interface AgentTextPart {
  type: "text";
  display?: "process" | "response";
  text: string;
}

export interface AgentReasoningPart {
  type: "reasoning";
  title?: string;
  text: string;
  durationSeconds?: number;
  status?: "completed" | "streaming";
}

export interface AgentTaskListPart {
  type: "tasks";
  title: string;
  tasks: AgentTaskItem[];
}

export interface AgentTaskItem {
  id: string;
  label: string;
  description?: string;
  status: "completed" | "error" | "in_progress" | "pending";
}

export interface AgentToolPart {
  type: "tool";
  callId: string;
  description?: string;
  input?: Record<string, unknown>;
  name: string;
  output?: string;
  status: "completed" | "error" | "running";
}

export interface AgentSubagentPart {
  type: "subagent";
  agentName: string;
  groupId?: string;
  status: "completed" | "error" | "running";
  title: string;
  input?: string;
  steps: Array<AgentReasoningPart | AgentTextPart | AgentToolPart>;
  output?: string;
}

export interface AgentSourcesPart {
  type: "sources";
  sources: AgentSourceItem[];
  title?: string;
}

export interface AgentSourceItem {
  id: string;
  label: string;
  meta?: string;
  tone?: AgentRenderTone;
  url?: string;
}

export interface AgentDecisionPart {
  type: "decision";
  action: string;
  confidence: number;
  rationale: string;
  risk: string;
  status: "auto_approved" | "blocked" | "needs_human" | "no_action";
  title: string;
  trade?: {
    direction: "long" | "short";
    instrument: string;
    notional: string;
    stopLoss: string;
    takeProfit: string;
  };
}

export interface AgentArtifactPart {
  type: "artifact";
  artifactType: "analysis" | "notification" | "order" | "risk";
  rows: Array<{ label: string; value: string }>;
  title: string;
  tone?: AgentRenderTone;
}

export interface AgentNoticePart {
  type: "notice";
  text: string;
  title: string;
  tone: AgentRenderTone;
}

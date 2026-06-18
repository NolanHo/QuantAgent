import type { AgentChatDisplayMessage } from "../types";

export function agentChatMessageTitle(message: AgentChatDisplayMessage): string {
  if (message.role === "user") return "user";
  if (message.kind === "tool") return "tool";
  if (message.kind === "subagent") return "subagent";
  if (message.kind === "todo") return "todo";
  if (message.kind === "artifact") return "artifact";
  if (message.kind === "interrupt") return "approval";
  if (message.kind === "error") return "error";
  if (message.kind === "final") return "final";
  return "assistant";
}

export type AgentChatDebugPreset = "nvda-earnings" | "nvda-media-followup";

export interface AgentChatSearch {
  preset?: AgentChatDebugPreset | null;
}

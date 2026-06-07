export type AgentChatIndustryAgentId = "quantagent.official.industry.semiconductor.agent.main";
export type AgentChatRoutedEventPreset = "nvda-earnings" | "nvda-media-followup";
export type AgentChatDebugPreset = AgentChatRoutedEventPreset;

export interface AgentChatSearch {
  agent?: AgentChatIndustryAgentId | null;
  preset?: AgentChatDebugPreset | null;
  routedEvent?: AgentChatRoutedEventPreset | null;
}

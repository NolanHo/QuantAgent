import type {
  AgentChatIndustryAgentId,
  AgentChatRoutedEventPreset,
  AgentChatSearch,
} from "../types";

export const semiconductorMainAgentId: AgentChatIndustryAgentId =
  "quantagent.official.industry.semiconductor.agent.main";

export const semiconductorIndustryId = "quantagent.official.industry.semiconductor";

export const agentChatIndustryAgentOptions: Array<{
  agentId: AgentChatIndustryAgentId;
  description: string;
  industryId: string;
  label: string;
}> = [
  {
    agentId: semiconductorMainAgentId,
    description: "半导体行业 MainAgent，从行业插件资产加载 prompt、tool profile、skills 和 Research SubAgent。",
    industryId: semiconductorIndustryId,
    label: "半导体 MainAgent",
  },
];

export const agentChatDebugPresetOptions: Array<{
  description: string;
  label: string;
  preset: AgentChatRoutedEventPreset;
}> = [
  {
    description: "第一手官方财报事件，默认用于验证检索市场预期、摘要和行动计划。",
    label: "英伟达财报",
    preset: "nvda-earnings",
  },
  {
    description: "后续媒体报道事件，默认用于验证同一事件窗口内的去重、降噪和不重复通知。",
    label: "媒体跟进",
    preset: "nvda-media-followup",
  },
];

export function normalizeAgentChatSearch(search: Record<string, unknown>): AgentChatSearch {
  const agent = typeof search.agent === "string" && isAgentChatIndustryAgentId(search.agent) ? search.agent : semiconductorMainAgentId;
  const routedEvent =
    typeof search.routedEvent === "string" && isAgentChatRoutedEventPreset(search.routedEvent)
      ? search.routedEvent
      : typeof search.preset === "string" && isAgentChatRoutedEventPreset(search.preset)
        ? search.preset
        : "nvda-earnings";
  return { agent, preset: routedEvent, routedEvent };
}

export function getAgentChatPresetMessage(preset: AgentChatRoutedEventPreset | null | undefined): string {
  if (preset === "nvda-earnings") {
    return [
      "调试事件：英伟达官方财报发布后 5 分钟内进入系统。",
      "请按半导体 MainAgent 的真实链路完整跑通这个事件：先识别第一手材料，再补充市场预期和盘前/盘后反应，随后继续进入账户上下文、thesis 评估、ActionPlan 生成和 submit_action_plan 提交。",
      "这是 dry-run/mock 调试案例，不会真实下单；如果评估建议 propose_trade，请务必调用 build_action_plan 和 submit_action_plan，让前端能看到完整行动流程、行动产物、通知/审批/监控状态。",
      "如果需要检索但工具不可用或缺少 Tavily key，请把工具失败视为可恢复信息，说明缺口后继续给出基于已有事件的保守结论。",
    ].join("\n");
  }
  if (preset === "nvda-media-followup") {
    return [
      "调试事件：媒体在官方财报后约 30 分钟发布英伟达业绩超预期报道。",
      "请判断它是否只是对已有第一手财报事件的二次报道，是否应该复用同一 session，是否需要再次通知用户，是否需要新增交易动作。",
      "如果缺少历史 run 或检索工具不可用，请明确说明无法确认的部分，但不要因为单个工具失败直接终止分析。",
    ].join("\n");
  }
  return "分析这个事件，并给出面向调试的简洁结论。";
}

export function getAgentChatPresetTitle(preset: AgentChatRoutedEventPreset | null | undefined): string {
  if (preset === "nvda-earnings") return "Agent Chat · 英伟达财报调试";
  if (preset === "nvda-media-followup") return "Agent Chat · 媒体跟进调试";
  return "Agent Chat";
}

export function getAgentChatIndustryAgentOption(agentId: AgentChatIndustryAgentId | null | undefined) {
  return agentChatIndustryAgentOptions.find((option) => option.agentId === agentId) ?? agentChatIndustryAgentOptions[0];
}

export function getAgentChatRoutedEventOption(preset: AgentChatRoutedEventPreset | null | undefined) {
  return agentChatDebugPresetOptions.find((option) => option.preset === preset) ?? agentChatDebugPresetOptions[0];
}

function isAgentChatIndustryAgentId(value: string): value is AgentChatIndustryAgentId {
  return value === semiconductorMainAgentId;
}

function isAgentChatRoutedEventPreset(value: string): value is AgentChatRoutedEventPreset {
  return value === "nvda-earnings" || value === "nvda-media-followup";
}

import type { AgentChatDebugPreset, AgentChatSearch } from "../types";

export const agentChatDebugPresetOptions: Array<{
  description: string;
  label: string;
  preset: AgentChatDebugPreset;
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
  const preset = typeof search.preset === "string" && isAgentChatDebugPreset(search.preset) ? search.preset : null;
  return { preset };
}

export function getAgentChatPresetMessage(preset: AgentChatDebugPreset | null | undefined): string {
  if (preset === "nvda-earnings") {
    return [
      "调试事件：英伟达官方财报发布后 5 分钟内进入系统。",
      "请按半导体 MainAgent 的真实链路分析这个事件：先识别第一手材料，再补充市场预期和盘前/盘后反应，给出简洁结论、风险点、是否需要行动计划，以及是否需要通知用户。",
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

export function getAgentChatPresetTitle(preset: AgentChatDebugPreset | null | undefined): string {
  if (preset === "nvda-earnings") return "Agent Chat · 英伟达财报调试";
  if (preset === "nvda-media-followup") return "Agent Chat · 媒体跟进调试";
  return "Agent Chat";
}

function isAgentChatDebugPreset(value: string): value is AgentChatDebugPreset {
  return value === "nvda-earnings" || value === "nvda-media-followup";
}

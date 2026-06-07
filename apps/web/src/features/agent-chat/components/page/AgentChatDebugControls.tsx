import {
  agentChatDebugPresetOptions,
  agentChatIndustryAgentOptions,
} from "../../utils";
import type { AgentChatIndustryAgentId, AgentChatRoutedEventPreset } from "../../types";

export function AgentChatDebugControls({
  agentId,
  routedEventPreset,
  onAgentChange,
  onRoutedEventChange,
}: {
  agentId: AgentChatIndustryAgentId;
  routedEventPreset: AgentChatRoutedEventPreset;
  onAgentChange(value: AgentChatIndustryAgentId): void;
  onRoutedEventChange(value: AgentChatRoutedEventPreset): void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-hairline bg-canvas p-3 shadow-sm md:grid-cols-2">
      <label className="grid gap-1 text-[12px] text-muted-strong">
        <span className="font-semibold uppercase">Industry MainAgent</span>
        <select
          className="h-10 rounded-md border border-hairline bg-surface-soft px-3 text-[13px] text-ink outline-none transition focus:border-primary/60"
          value={agentId}
          onChange={(event) => onAgentChange(event.target.value as AgentChatIndustryAgentId)}
        >
          {agentChatIndustryAgentOptions.map((option) => (
            <option key={option.agentId} value={option.agentId}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="leading-5">{agentChatIndustryAgentOptions[0]?.description}</span>
      </label>
      <label className="grid gap-1 text-[12px] text-muted-strong">
        <span className="font-semibold uppercase">Routed Event</span>
        <select
          className="h-10 rounded-md border border-hairline bg-surface-soft px-3 text-[13px] text-ink outline-none transition focus:border-primary/60"
          value={routedEventPreset}
          onChange={(event) => onRoutedEventChange(event.target.value as AgentChatRoutedEventPreset)}
        >
          {agentChatDebugPresetOptions.map((option) => (
            <option key={option.preset} value={option.preset}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="leading-5">
          {agentChatDebugPresetOptions.find((option) => option.preset === routedEventPreset)?.description}
        </span>
      </label>
    </div>
  );
}

import { ChevronDown } from "lucide-react";
import { AgentMarkdown } from "../../conversation/AgentMarkdown";
import type { AgentChainStep } from "./agent-chain-types";
import { AgentChainStepList } from "./AgentChainStepList";

export function AgentSubagentNode({
  agentName,
  input,
  output,
  steps,
}: {
  agentName?: string;
  input?: string;
  output?: string;
  steps: readonly AgentChainStep[];
}) {
  return (
    <div className="grid gap-2">
      {input ? (
        <div className="line-clamp-3 text-body-sm leading-6 text-muted-strong">
          <span className="font-bold text-ink">委托输入：</span>
          {input}
        </div>
      ) : null}
      {steps.length ? (
        <details className="group rounded-md border border-hairline bg-canvas/70">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-caption font-bold text-muted-strong">
            <span>{agentName ? `${agentName} · ` : ""}执行细节 · {steps.length} steps</span>
            <ChevronDown aria-hidden className="size-3 transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-hairline px-2 py-2">
            <AgentChainStepList steps={steps} />
          </div>
        </details>
      ) : null}
      {output ? (
        <div className="line-clamp-5 text-body-sm leading-6 text-muted-strong">
          <AgentMarkdown content={output} />
        </div>
      ) : null}
    </div>
  );
}

import { AgentMarkdown } from "../../conversation/AgentMarkdown";
import type { AgentChainStep } from "./agent-chain-types";
import { AgentChainStepList } from "./AgentChainStepList";

export function AgentSubagentNode({
  input,
  output,
  steps,
}: {
  input?: string;
  output?: string;
  steps: readonly AgentChainStep[];
}) {
  return (
    <div className="grid gap-3">
      {input ? (
        <div className="rounded-md border border-hairline bg-surface-soft px-3 py-2 text-body-sm text-muted-strong">
          <span className="font-bold text-ink">委托输入：</span>
          {input}
        </div>
      ) : null}
      <div className="grid gap-0 border-l-2 border-hairline pl-3">
        <AgentChainStepList steps={steps} />
      </div>
      {output ? (
        <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
          <AgentMarkdown content={output} />
        </div>
      ) : null}
    </div>
  );
}

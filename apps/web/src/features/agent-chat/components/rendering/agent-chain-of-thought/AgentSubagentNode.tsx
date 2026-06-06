import { ChainOfThought, ChainOfThoughtContent, ChainOfThoughtHeader } from "@/components/ai-elements/chain-of-thought";
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
        <div className="text-body-sm leading-6 text-muted-strong">
          <span className="font-bold text-ink">委托输入：</span>
          {input}
        </div>
      ) : null}
      {steps.length ? (
        <ChainOfThought defaultOpen={false}>
          <ChainOfThoughtHeader className="text-xs">
            {agentName ? `${agentName} · ` : ""}执行细节 · {steps.length} steps
          </ChainOfThoughtHeader>
          <ChainOfThoughtContent className="ml-1">
            <AgentChainStepList steps={steps} />
          </ChainOfThoughtContent>
        </ChainOfThought>
      ) : null}
      {output ? (
        <div className="text-body-sm leading-6 text-muted-strong">
          <AgentMarkdown content={output} />
        </div>
      ) : null}
    </div>
  );
}

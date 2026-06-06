import type { AgentRenderPart } from "../../../types";
import { ChainOfThought, ChainOfThoughtContent, ChainOfThoughtHeader } from "@/components/ai-elements/chain-of-thought";
import { AgentChainStepList } from "./AgentChainStepList";
import { partToAgentChainSteps } from "./part-to-agent-chain-steps";

export function AgentChainOfThought({ parts }: { parts: readonly AgentRenderPart[] }) {
  const steps = parts.flatMap(partToAgentChainSteps);

  if (!steps.length) return null;

  return (
    <ChainOfThought data-agent-render-lane="main" data-agent-render-target="cot" defaultOpen>
      <ChainOfThoughtHeader>思考与执行过程 · {steps.length} steps</ChainOfThoughtHeader>
      <ChainOfThoughtContent>
        <AgentChainStepList steps={steps} />
      </ChainOfThoughtContent>
    </ChainOfThought>
  );
}

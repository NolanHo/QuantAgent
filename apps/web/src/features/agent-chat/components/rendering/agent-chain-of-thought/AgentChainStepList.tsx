import { ChainOfThoughtStep } from "@/components/ai-elements/chain-of-thought";
import type { AgentChainStep } from "./agent-chain-types";

export function AgentChainStepList({ steps }: { steps: readonly AgentChainStep[] }) {
  return (
    <>
      {steps.map((step) => (
        <ChainOfThoughtStep
          description={step.description}
          icon={step.icon}
          key={step.id}
          label={step.title}
          status={toChainOfThoughtStatus(step.status)}
        >
          {step.body}
        </ChainOfThoughtStep>
      ))}
    </>
  );
}

function toChainOfThoughtStatus(status: AgentChainStep["status"]): "complete" | "active" | "pending" {
  if (status === "pending") return "pending";
  if (status === "running" || status === "error") return "active";
  return "complete";
}

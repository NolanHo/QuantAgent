import type { AgentRenderPart } from "../../../types";
import { ChainOfThought, ChainOfThoughtContent, ChainOfThoughtHeader } from "@/components/ai-elements/chain-of-thought";
import { AgentChainStepList } from "./AgentChainStepList";
import { partToAgentChainSteps } from "./part-to-agent-chain-steps";

export function AgentChainOfThought({ parts }: { parts: readonly AgentRenderPart[] }) {
  const steps = parts.flatMap(partToAgentChainSteps);
  const summary = summarizeParts(parts);
  const hasRunningStep = steps.some((step) => step.status === "running" || step.status === "pending");
  const defaultOpen = hasRunningStep || steps.length <= 8;

  if (!steps.length) return null;

  return (
    <ChainOfThought data-agent-render-lane="main" data-agent-render-target="cot" defaultOpen={defaultOpen}>
      <ChainOfThoughtHeader>
        思考与执行过程 · {steps.length} steps{summary ? ` · ${summary}` : ""}
        {!defaultOpen ? " · 已折叠" : ""}
      </ChainOfThoughtHeader>
      <ChainOfThoughtContent>
        <AgentChainStepList steps={steps} />
      </ChainOfThoughtContent>
    </ChainOfThought>
  );
}

function summarizeParts(parts: readonly AgentRenderPart[]): string {
  const toolCount = parts.filter((part) => part.type === "tool").length;
  const subagentCount = parts.filter((part) => part.type === "subagent").length;
  const actionArtifactCount = parts.filter(
    (part) => part.type === "artifact" && ["action_plan", "submission", "thesis"].includes(part.artifactType),
  ).length;
  return [
    subagentCount ? `${subagentCount} SubAgent` : "",
    toolCount ? `${toolCount} 工具` : "",
    actionArtifactCount ? `${actionArtifactCount} 行动产物` : "",
  ]
    .filter(Boolean)
    .join(" / ");
}

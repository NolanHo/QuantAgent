import { Bot, CheckCircle2, FileText, Send, TrendingUp } from "lucide-react";
import { twMerge } from "tailwind-merge";

import type { AgentActionFlowPart, AgentArtifactPart, AgentRenderPart } from "../../types";

interface RunSummaryItem {
  id: string;
  label: string;
  meta: string;
  tone: "info" | "success" | "warning";
  icon: typeof TrendingUp;
}

export function AgentMessageRunSummary({ parts }: { parts: readonly AgentRenderPart[] }) {
  const items = buildRunSummaryItems(parts);
  if (!items.length) return null;

  return (
    <section className="grid gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-3" data-agent-render-target="run-summary">
      <div className="flex items-center gap-2 text-body-sm font-black text-ink">
        <TrendingUp aria-hidden className="size-4 text-primary" />
        本次运行重点
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {items.map((item) => (
          <RunSummaryPill item={item} key={item.id} />
        ))}
      </div>
    </section>
  );
}

function RunSummaryPill({ item }: { item: RunSummaryItem }) {
  const Icon = item.icon;
  return (
    <div className={twMerge("flex items-start gap-2 rounded-md border px-3 py-2", itemToneClass(item.tone))}>
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        <div className="truncate text-body-sm font-bold text-ink">{item.label}</div>
        <div className="line-clamp-2 text-caption leading-5 text-muted-strong">{item.meta}</div>
      </div>
    </div>
  );
}

function buildRunSummaryItems(parts: readonly AgentRenderPart[]): RunSummaryItem[] {
  const items: RunSummaryItem[] = [];
  const actionFlow = parts.find((part): part is AgentActionFlowPart => part.type === "action_flow");
  if (actionFlow) {
    const completed = actionFlow.stages.filter((stage) => stage.status === "completed").length;
    const failed = actionFlow.stages.some((stage) => stage.status === "error");
    const running = actionFlow.stages.find((stage) => stage.status === "running");
    const pending = actionFlow.stages.find((stage) => stage.status === "pending");
    const focus = running ?? pending ?? actionFlow.stages.at(-1);
    items.push({
      icon: failed ? Send : CheckCircle2,
      id: "action-flow",
      label: `行动流程 ${completed}/${actionFlow.stages.length}`,
      meta: failed ? "存在失败步骤，需要查看工具结果。" : focus?.summary ?? focus?.label ?? "等待行动链路更新。",
      tone: failed ? "warning" : completed === actionFlow.stages.length ? "success" : "info",
    });
  }

  const submission = latestArtifact(parts, "submission");
  if (submission) {
    items.push({
      icon: Send,
      id: "submission",
      label: "提交结果",
      meta: submission.summary ?? rowValue(submission, "摘要") ?? "ActionPlan 已提交。",
      tone: "success",
    });
  }

  const reports = countArtifacts(parts, "report");
  const actionArtifacts = parts.filter((part) => part.type === "artifact" && ["action_plan", "submission", "thesis"].includes(part.artifactType)).length;
  if (reports || actionArtifacts) {
    items.push({
      icon: FileText,
      id: "artifacts",
      label: `产物 ${reports + actionArtifacts}`,
      meta: [reports ? `${reports} 份报告` : "", actionArtifacts ? `${actionArtifacts} 个行动产物` : ""].filter(Boolean).join("，"),
      tone: "info",
    });
  }

  const subagents = parts.filter((part) => part.type === "subagent");
  if (subagents.length) {
    const running = subagents.find((part) => part.status === "running");
    items.push({
      icon: Bot,
      id: "subagents",
      label: `SubAgent ${subagents.length}`,
      meta: running ? `${running.agentName} 正在运行` : subagents.map((part) => part.agentName).join("，"),
      tone: running ? "info" : "success",
    });
  }

  return items.slice(0, 4);
}

function latestArtifact(parts: readonly AgentRenderPart[], type: AgentArtifactPart["artifactType"]) {
  return parts
    .filter((part): part is AgentArtifactPart => part.type === "artifact" && part.artifactType === type)
    .at(-1);
}

function countArtifacts(parts: readonly AgentRenderPart[], type: AgentArtifactPart["artifactType"]) {
  return parts.filter((part) => part.type === "artifact" && part.artifactType === type).length;
}

function rowValue(part: AgentArtifactPart, label: string) {
  return part.rows.find((row) => row.label === label)?.value;
}

function itemToneClass(tone: RunSummaryItem["tone"]) {
  if (tone === "success") return "border-trading-up/20 bg-canvas text-trading-up";
  if (tone === "warning") return "border-[#f7c36b] bg-[#fff8ed] text-[#9a5b00]";
  return "border-primary/15 bg-canvas text-primary";
}

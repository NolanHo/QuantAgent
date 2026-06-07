import {
  AlertTriangle,
  Bell,
  Bot,
  CheckCircle2,
  Circle,
  FileText,
  Hammer,
  ListChecks,
  Search,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

import type {
  AgentArtifactPart,
  AgentDecisionPart,
  AgentNoticePart,
  AgentRenderPart,
  AgentSourcesPart,
  AgentSubagentPart,
  AgentTaskListPart,
  AgentToolPart,
} from "../../../types";
import { ChainOfThoughtSearchResult, ChainOfThoughtSearchResults } from "@/components/ai-elements/chain-of-thought";
import { AgentMarkdown } from "../../conversation/AgentMarkdown";
import { AgentReportArtifactCard } from "../AgentReportArtifactCard";
import type { AgentChainStep } from "./agent-chain-types";
import { AgentSubagentNode } from "./AgentSubagentNode";
import { AgentToolNode } from "./AgentToolNode";
import { KeyValueRows } from "./KeyValueRows";

export function partToAgentChainSteps(part: AgentRenderPart): AgentChainStep[] {
  switch (part.type) {
    case "artifact":
      return [artifactStep(part)];
    case "decision":
      return [decisionStep(part)];
    case "notice":
      return [noticeStep(part)];
    case "reasoning":
      return [
        {
          id: `reasoning-${part.title ?? ""}-${part.text.slice(0, 24)}`,
          status: part.status === "streaming" ? "running" : "completed",
          title: <ReasoningMarkdown text={part.text} />,
        },
      ];
    case "sources":
      return [sourcesStep(part)];
    case "subagent":
      return [subagentStep(part)];
    case "tasks":
      return [tasksStep(part)];
    case "text":
      return [
        {
          id: `text-${part.text.slice(0, 24)}`,
          status: "completed",
          title: part.display === "process" ? <ReasoningMarkdown text={part.text} /> : part.text,
        },
      ];
    case "tool":
      return [toolStep(part)];
  }
}

function ReasoningMarkdown({ text }: { text: string }) {
  return (
    <div className="text-body-sm leading-6 text-muted-strong">
      <AgentMarkdown content={text} />
    </div>
  );
}

function toolStep(part: AgentToolPart): AgentChainStep {
  return {
    icon: Hammer,
    id: `tool-${part.callId}`,
    status: normalizeStatus(part.status),
    title: <AgentToolNode part={part} />,
  };
}

function subagentStep(part: AgentSubagentPart): AgentChainStep {
  return {
    body: <AgentSubagentNode agentName={part.agentName} input={part.input} output={part.output} steps={part.steps.flatMap(partToAgentChainSteps)} />,
    icon: Bot,
    id: `subagent-${part.agentName}-${part.title}`,
    status: normalizeStatus(part.status),
    title: (
      <div className="grid gap-0.5">
        <div className="font-semibold text-ink">{part.title}</div>
        <div className="font-mono text-xs text-muted-strong">{part.agentName}</div>
      </div>
    ),
  };
}

function tasksStep(part: AgentTaskListPart): AgentChainStep {
  const completed = part.tasks.filter((task) => task.status === "completed").length;
  return {
    body: (
      <div className="grid gap-2">
        {part.tasks.map((task) => (
          <div className="grid grid-cols-[1rem_minmax(0,1fr)] gap-2 text-body-sm" key={task.id}>
            {task.status === "completed" ? <CheckCircle2 aria-hidden className="mt-0.5 size-3.5 text-trading-up" /> : <Circle aria-hidden className="mt-0.5 size-3.5 text-muted" />}
            <div className="min-w-0">
              <div className="font-semibold text-ink">{task.label}</div>
              {task.description ? <div className="text-caption text-muted-strong">{task.description}</div> : null}
            </div>
          </div>
        ))}
      </div>
    ),
    description: `${completed}/${part.tasks.length} completed`,
    icon: ListChecks,
    id: `tasks-${part.title}`,
    status: completed === part.tasks.length ? "completed" : "running",
    title: part.title,
  };
}

function sourcesStep(part: AgentSourcesPart): AgentChainStep {
  return {
    body: (
      <ChainOfThoughtSearchResults>
        {part.sources.map((source) => (
          <ChainOfThoughtSearchResult key={source.id}>
            {source.label}
            {source.meta ? <span className="ml-1 font-medium opacity-75">{source.meta}</span> : null}
          </ChainOfThoughtSearchResult>
        ))}
      </ChainOfThoughtSearchResults>
    ),
    icon: Search,
    id: `sources-${part.title ?? "sources"}`,
    status: "completed",
    title: part.title ?? "参考来源",
  };
}

function decisionStep(part: AgentDecisionPart): AgentChainStep {
  return {
    body: (
      <div className="grid gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-body-sm">
        <div className="font-semibold text-ink">{part.rationale}</div>
        {part.trade ? (
          <div className="grid gap-1 text-muted-strong">
            <div>标的：{part.trade.instrument}</div>
            <div>规模：{part.trade.notional}</div>
            <div>止盈：{part.trade.takeProfit}</div>
            <div>止损：{part.trade.stopLoss}</div>
          </div>
        ) : null}
        <div className="text-muted-strong">风险：{part.risk}</div>
      </div>
    ),
    description: `${part.action} · confidence ${Math.round(part.confidence * 100)}%`,
    icon: TrendingUp,
    id: `decision-${part.title}`,
    status: part.status === "blocked" ? "error" : "completed",
    title: part.title,
  };
}

function artifactStep(part: AgentArtifactPart): AgentChainStep {
  if (part.artifactType === "report") {
    return {
      body: <AgentReportArtifactCard compact part={part} />,
      icon: FileText,
      id: `artifact-report-${part.groupId ?? part.artifactId ?? part.title}`,
      status: "completed",
      title: "报告已生成",
    };
  }
  return {
    body: <KeyValueRows rows={part.rows} />,
    icon: part.artifactType === "notification" ? Bell : part.artifactType === "order" ? ShieldCheck : FileText,
    id: `artifact-${part.title}`,
    status: "completed",
    title: part.title,
  };
}

function noticeStep(part: AgentNoticePart): AgentChainStep {
  return {
    body: <div className="text-body-sm text-muted-strong">{part.text}</div>,
    icon: AlertTriangle,
    id: `notice-${part.title}`,
    status: part.tone === "danger" ? "error" : "completed",
    title: part.title,
  };
}

function normalizeStatus(status: "completed" | "error" | "running"): AgentChainStep["status"] {
  return status === "completed" ? "completed" : status === "error" ? "error" : "running";
}

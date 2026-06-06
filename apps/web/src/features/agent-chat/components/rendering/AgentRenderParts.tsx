import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Circle,
  Clock3,
  ExternalLink,
  FileText,
  Hammer,
  Loader2,
  ShieldCheck,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { twMerge } from "tailwind-merge";

import type {
  AgentArtifactPart,
  AgentDecisionPart,
  AgentNoticePart,
  AgentRenderPart,
  AgentRenderTone,
  AgentSourcesPart,
  AgentSubagentPart,
  AgentTaskItem,
  AgentTaskListPart,
  AgentToolPart,
} from "../../types";
import { AgentMarkdown } from "../conversation/AgentMarkdown";
import { MessageResponse, Reasoning } from "./AgentChatElements";
import { AgentReportArtifactCard } from "./AgentReportArtifactCard";
import { AgentSubagentNode, partToAgentChainSteps } from "./agent-chain-of-thought";

export function AgentRenderPartView({ part }: { part: AgentRenderPart }) {
  switch (part.type) {
    case "artifact":
      return <ArtifactPartView part={part} />;
    case "decision":
      return <DecisionPartView part={part} />;
    case "notice":
      return <NoticePartView part={part} />;
    case "reasoning":
      return (
        <Reasoning durationSeconds={part.durationSeconds} isStreaming={part.status === "streaming"} title={part.title}>
          {part.text}
        </Reasoning>
      );
    case "sources":
      return <SourcesPartView part={part} />;
    case "subagent":
      return <SubagentPartView part={part} />;
    case "tasks":
      return <TaskListPartView part={part} />;
    case "text":
      return <MessageResponse>{part.text}</MessageResponse>;
    case "tool":
      return <ToolPartView part={part} />;
  }
}

function SubagentPartView({ part }: { part: AgentSubagentPart }) {
  return (
    <section
      className="grid gap-2 rounded-lg border border-hairline bg-surface-soft/70 px-3 py-3"
      data-agent-render-lane="subagent"
      data-agent-render-group={part.groupId ?? part.agentName}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-body-sm font-bold text-ink">{part.title}</div>
          <div className="font-mono text-caption text-muted">{part.agentName}</div>
        </div>
        <StatusPill status={part.status} />
      </header>
      <AgentSubagentNode agentName={part.agentName} input={part.input} output={part.output} steps={part.steps.flatMap(partToAgentChainSteps)} />
    </section>
  );
}

function TaskListPartView({ part }: { part: AgentTaskListPart }) {
  const completed = part.tasks.filter((task) => task.status === "completed").length;
  return (
    <section className="rounded-lg border border-hairline bg-surface-soft">
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-3 py-2">
        <div className="font-bold text-ink">{part.title}</div>
        <span className="rounded-full bg-canvas px-2 py-0.5 font-mono text-caption font-bold text-muted-strong">
          {completed}/{part.tasks.length}
        </span>
      </header>
      <div className="grid gap-2 p-3">
        {part.tasks.map((task) => (
          <TaskItemView item={task} key={task.id} />
        ))}
      </div>
    </section>
  );
}

function TaskItemView({ item }: { item: AgentTaskItem }) {
  const Icon = item.status === "completed" ? CheckCircle2 : item.status === "error" ? XCircle : item.status === "in_progress" ? Loader2 : Circle;
  return (
    <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-2">
      <Icon
        aria-hidden
        className={twMerge(
          "mt-0.5 size-4",
          item.status === "completed" ? "text-trading-up" : "",
          item.status === "error" ? "text-trading-down" : "",
          item.status === "in_progress" ? "animate-spin text-primary" : "",
          item.status === "pending" ? "text-muted" : "",
        )}
      />
      <div className="min-w-0">
        <div className="text-body-sm font-semibold text-ink">{item.label}</div>
        {item.description ? <div className="text-caption leading-5 text-muted-strong">{item.description}</div> : null}
      </div>
    </div>
  );
}

function ToolPartView({ compact = false, part }: { compact?: boolean; part: AgentToolPart }) {
  return (
    <section className="overflow-hidden rounded-lg border border-hairline bg-canvas">
      <header className="flex items-center justify-between gap-3 bg-surface-soft px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Hammer aria-hidden className="size-4 text-muted-strong" />
          <div className="min-w-0">
            <div className="truncate text-body-sm font-bold text-ink">{part.name}</div>
            <div className="font-mono text-caption text-muted">{part.callId}</div>
          </div>
        </div>
        <StatusPill status={part.status} />
      </header>
      <div className={twMerge("grid gap-3 p-3", compact ? "text-body-sm" : "")}>
        {part.description ? <p className="m-0 text-body-sm text-muted-strong">{part.description}</p> : null}
        {part.input ? <KeyValueGrid rows={Object.entries(part.input).map(([label, value]) => ({ label, value: formatDisplayValue(value) }))} title="输入" /> : null}
        {part.output ? (
          <div className="rounded-md border border-hairline bg-surface-soft px-3 py-2">
            <AgentMarkdown content={part.output} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SourcesPartView({ part }: { part: AgentSourcesPart }) {
  return (
    <section className="rounded-lg border border-hairline bg-canvas px-3 py-3">
      <div className="mb-2 flex items-center gap-2 text-body-sm font-bold text-ink">
        <FileText aria-hidden className="size-4 text-muted-strong" />
        {part.title ?? "参考来源"}
      </div>
      <div className="flex flex-wrap gap-2">
        {part.sources.map((source) =>
          source.url ? (
            <a
              className={twMerge("inline-flex items-center gap-1 rounded-full border px-3 py-1 text-caption font-bold", toneClass(source.tone ?? "neutral"))}
              href={source.url}
              key={source.id}
              rel="noreferrer"
              target="_blank"
            >
              {source.label}
              <ExternalLink aria-hidden className="size-3" />
            </a>
          ) : (
            <span className={twMerge("inline-flex rounded-full border px-3 py-1 text-caption font-bold", toneClass(source.tone ?? "neutral"))} key={source.id}>
              {source.label}
              {source.meta ? <span className="ml-1 font-medium opacity-75">{source.meta}</span> : null}
            </span>
          ),
        )}
      </div>
    </section>
  );
}

function DecisionPartView({ part }: { part: AgentDecisionPart }) {
  return (
    <section className="rounded-lg border border-primary/25 bg-primary/5 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-title-sm font-bold text-ink">
            <TrendingUp aria-hidden className="size-4 text-primary" />
            {part.title}
          </div>
          <p className="m-0 mt-1 text-body-sm text-muted-strong">{part.rationale}</p>
        </div>
        <span className="rounded-full bg-primary px-3 py-1 text-caption font-black text-on-primary">{Math.round(part.confidence * 100)}%</span>
      </div>
      {part.trade ? (
        <div className="grid gap-2 md:grid-cols-2">
          <KeyValueGrid
            rows={[
              { label: "方向", value: part.trade.direction === "long" ? "做多" : "做空" },
              { label: "标的", value: part.trade.instrument },
              { label: "规模", value: part.trade.notional },
            ]}
            title="交易计划"
          />
          <KeyValueGrid
            rows={[
              { label: "止盈", value: part.trade.takeProfit },
              { label: "止损", value: part.trade.stopLoss },
              { label: "授权", value: decisionStatusLabel(part.status) },
            ]}
            title="风控"
          />
        </div>
      ) : null}
      <div className="mt-3 rounded-md border border-hairline bg-canvas px-3 py-2 text-body-sm text-muted-strong">
        <span className="font-bold text-ink">风险点：</span>
        {part.risk}
      </div>
    </section>
  );
}

function ArtifactPartView({ part }: { part: AgentArtifactPart }) {
  const Icon = part.artifactType === "notification" ? Bell : part.artifactType === "order" ? ShieldCheck : FileText;
  if (part.artifactType === "report") {
      return <AgentReportArtifactCard part={part} />;
  }
  return (
    <section className={twMerge("rounded-lg border p-3", tonePanelClass(part.tone ?? "neutral"))}>
      <div className="mb-2 flex items-center gap-2 text-body-sm font-bold text-ink">
        <Icon aria-hidden className="size-4 text-muted-strong" />
        {part.title}
      </div>
      <KeyValueRows rows={part.rows} />
    </section>
  );
}

function NoticePartView({ part }: { part: AgentNoticePart }) {
  const Icon = part.tone === "danger" || part.tone === "warning" ? AlertTriangle : part.tone === "success" ? CheckCircle2 : Clock3;
  return (
    <section className={twMerge("rounded-lg border px-3 py-3", tonePanelClass(part.tone))}>
      <div className="mb-1 flex items-center gap-2 text-body-sm font-bold text-ink">
        <Icon aria-hidden className="size-4" />
        {part.title}
      </div>
      <p className="m-0 text-body-sm text-muted-strong">{part.text}</p>
    </section>
  );
}

function KeyValueGrid({ rows, title }: { rows: Array<{ label: string; value: string }>; title: string }) {
  return (
    <div className="rounded-md border border-hairline bg-canvas p-3">
      <div className="mb-2 text-caption font-black uppercase text-muted-strong">{title}</div>
      <KeyValueRows rows={rows} />
    </div>
  );
}

function KeyValueRows({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 text-body-sm" key={row.label}>
          <span className="text-muted">{row.label}</span>
          <span className="min-w-0 break-words font-semibold text-ink">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function formatDisplayValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function StatusPill({ status }: { status: AgentToolPart["status"] }) {
  const label = status === "completed" ? "完成" : status === "error" ? "失败" : "运行中";
  return (
    <span
      className={twMerge(
        "rounded-full px-2 py-0.5 text-caption font-black",
        status === "completed" ? "bg-trading-up/10 text-trading-up" : "",
        status === "error" ? "bg-trading-down/10 text-trading-down" : "",
        status === "running" ? "bg-primary/10 text-primary" : "",
      )}
    >
      {label}
    </span>
  );
}

function decisionStatusLabel(status: AgentDecisionPart["status"]) {
  if (status === "auto_approved") return "自动审批通过";
  if (status === "needs_human") return "需要人工确认";
  if (status === "blocked") return "策略门禁阻断";
  return "不交易";
}

function toneClass(tone: AgentRenderTone) {
  if (tone === "success") return "border-trading-up/20 bg-trading-up/10 text-trading-up";
  if (tone === "warning") return "border-[#f7c36b] bg-[#fff8ed] text-[#9a5b00]";
  if (tone === "danger") return "border-trading-down/20 bg-trading-down/10 text-trading-down";
  if (tone === "info") return "border-primary/20 bg-primary/10 text-primary";
  return "border-hairline bg-surface-soft text-muted-strong";
}

function tonePanelClass(tone: AgentRenderTone) {
  if (tone === "success") return "border-trading-up/20 bg-trading-up/5";
  if (tone === "warning") return "border-[#f7c36b] bg-[#fff8ed]";
  if (tone === "danger") return "border-trading-down/20 bg-trading-down/5";
  if (tone === "info") return "border-primary/20 bg-primary/5";
  return "border-hairline bg-canvas";
}

import { AlertTriangle, Bot, CheckCircle2, Circle, FileText, Hammer, Loader2, RadioTower, Send, ShieldCheck, SquareStack, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

import { AgentMarkdown } from "../conversation/AgentMarkdown";
import { AgentJsonBlock } from "./AgentJsonBlock";

export function AgentRuntimePanels({
  artifacts,
  interrupts,
  runtimeEvents,
  subagents,
  todos,
  toolCalls,
}: {
  artifacts: readonly unknown[];
  interrupts: readonly unknown[];
  runtimeEvents: readonly unknown[];
  subagents: readonly unknown[];
  todos: readonly unknown[];
  toolCalls: readonly unknown[];
}) {
  return (
    <div className="grid gap-3">
      <TodoPanel todos={todos} />
      <RuntimeList
        empty="暂无工具调用"
        icon={<Hammer aria-hidden className="size-4" />}
        items={toolCalls}
        renderItem={(item, index) => <ToolRunCard item={item} key={itemKey(item, index)} />}
        title="Tools"
      />
      <RuntimeList
        empty="暂无 SubAgent"
        icon={<Bot aria-hidden className="size-4" />}
        items={subagents}
        renderItem={(item, index) => <RuntimeDetailCard item={item} key={itemKey(item, index)} title={runtimeTitle(item, "SubAgent")} />}
        title="SubAgents"
      />
      <RuntimeList
        empty="暂无 artifact"
        icon={<FileText aria-hidden className="size-4" />}
        items={artifacts}
        renderItem={(item, index) => <ArtifactRuntimeCard item={item} key={itemKey(item, index)} />}
        title="Artifacts"
      />
      <RuntimeList
        empty="暂无人工介入"
        icon={<AlertTriangle aria-hidden className="size-4" />}
        items={interrupts}
        renderItem={(item, index) => <RuntimeDetailCard item={item} key={itemKey(item, index)} tone="warning" title={runtimeTitle(item, "Interrupt")} />}
        title="Interrupts"
        tone={interrupts.length ? "warning" : "default"}
      />
      <RuntimeList
        empty="暂无 runtime event"
        icon={<RadioTower aria-hidden className="size-4" />}
        items={runtimeEvents.slice(-8)}
        renderItem={(item, index) => <RuntimeEventRow item={item} key={itemKey(item, index)} />}
        title="Runtime Events"
      />
    </div>
  );
}

function TodoPanel({ todos }: { todos: readonly unknown[] }) {
  const stats = todoStats(todos);
  return (
    <section className="rounded-lg border border-hairline bg-surface-soft p-3">
      <PanelHeader
        icon={<SquareStack aria-hidden className="size-4" />}
        meta={todos.length ? `${stats.done}/${todos.length}` : undefined}
        title="Todos"
      />
      {todos.length ? (
        <div className="mt-3 grid gap-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-hairline">
            <div className="h-full rounded-full bg-primary" style={{ width: `${stats.percent}%` }} />
          </div>
          <div className="grid gap-2">
            {todos.map((todo, index) => (
              <TodoItem item={todo} key={itemKey(todo, index)} />
            ))}
          </div>
        </div>
      ) : (
        <EmptyRuntimeText>暂无 todos</EmptyRuntimeText>
      )}
    </section>
  );
}

function TodoItem({ item }: { item: unknown }) {
  const status = normalizedStatus(readPath(item, ["status"]) ?? readPath(item, ["state"]));
  const Icon = status === "completed" ? CheckCircle2 : status === "in_progress" ? Loader2 : Circle;
  return (
    <div className="grid grid-cols-[1rem_minmax(0,1fr)] gap-2 text-[13px] leading-5">
      <Icon
        aria-hidden
        className={`mt-0.5 size-4 ${status === "completed" ? "text-trading-up" : status === "in_progress" ? "animate-spin text-primary" : "text-muted"}`}
      />
      <div className="min-w-0">
        <div className="break-words font-medium text-ink">{String(readPath(item, ["content"]) ?? readPath(item, ["task"]) ?? readPath(item, ["title"]) ?? item)}</div>
        <div className="font-mono text-[11px] text-muted">{status}</div>
      </div>
    </div>
  );
}

function RuntimeList({
  empty,
  icon,
  items,
  renderItem,
  title,
  tone = "default",
}: {
  empty: string;
  icon: ReactNode;
  items: readonly unknown[];
  renderItem(item: unknown, index: number): ReactNode;
  title: string;
  tone?: "default" | "warning";
}) {
  return (
    <section className={`rounded-lg border p-3 ${tone === "warning" ? "border-warning/30 bg-warning/10" : "border-hairline bg-surface-soft"}`}>
      <PanelHeader icon={icon} meta={items.length ? String(items.length) : undefined} title={title} />
      {items.length ? <div className="mt-3 grid gap-2">{items.map(renderItem)}</div> : <EmptyRuntimeText>{empty}</EmptyRuntimeText>}
    </section>
  );
}

function ToolRunCard({ item }: { item: unknown }) {
  const title = runtimeTitle(item, "tool");
  const status = normalizedStatus(readPath(item, ["status"]) ?? readPath(item, ["state"]) ?? readPath(item, ["type"]) ?? readPath(item, ["kind"]));
  return (
    <details className="group rounded-md border border-hairline bg-canvas">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-[13px] font-semibold text-ink">
        <span className="min-w-0 truncate">{title}</span>
        <RuntimeBadge status={status} />
      </summary>
      <div className="border-t border-hairline p-2">
        <AgentJsonBlock value={item} />
      </div>
    </details>
  );
}

function ArtifactRuntimeCard({ item }: { item: unknown }) {
  const artifact = readRuntimeArtifact(item);
  if (!artifact) {
    return <RuntimeDetailCard item={item} title={runtimeTitle(item, "Artifact")} />;
  }
  const Icon = artifact.type === "thesis" ? TrendingUp : artifact.type === "action_plan" ? ShieldCheck : artifact.type === "submission" ? Send : FileText;
  return (
    <details className="group rounded-md border border-hairline bg-canvas">
      <summary className="cursor-pointer list-none px-3 py-2">
        <div className="flex items-start justify-between gap-3">
          <div className="grid min-w-0 gap-1">
            <div className="flex min-w-0 items-center gap-2">
              <Icon aria-hidden className="size-4 shrink-0 text-primary" />
              <div className="truncate text-[13px] font-semibold text-ink">{artifact.title}</div>
            </div>
            <div className="flex flex-wrap gap-2 font-mono text-[11px] text-muted">
              {artifact.agentName ? <span>{artifact.agentName}</span> : null}
              {artifact.sourceSeq ? <span>seq {artifact.sourceSeq}</span> : null}
            </div>
            {artifact.summary ? <div className="line-clamp-2 text-[12px] leading-5 text-muted-strong">{artifact.summary}</div> : null}
          </div>
          <RuntimeBadge status="completed" />
        </div>
      </summary>
      <div className="border-t border-hairline p-3">
        {artifact.contentMarkdown ? (
          <div className="max-h-[32rem] overflow-auto pr-1 text-[13px] leading-6 text-muted-strong">
            <AgentMarkdown content={artifact.contentMarkdown} />
          </div>
        ) : artifact.rows.length ? (
          <div className="grid gap-2 text-[12px]">
            {artifact.rows.map((row) => (
              <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2" key={row.label}>
                <span className="text-muted">{row.label}</span>
                <span className="min-w-0 break-words font-semibold text-ink">{row.value}</span>
              </div>
            ))}
          </div>
        ) : (
          <AgentJsonBlock value={item} />
        )}
      </div>
    </details>
  );
}

function RuntimeDetailCard({
  item,
  title,
  tone = "default",
}: {
  item: unknown;
  title: string;
  tone?: "default" | "warning";
}) {
  return (
    <details className={`group rounded-md border bg-canvas ${tone === "warning" ? "border-warning/30" : "border-hairline"}`}>
      <summary className="cursor-pointer list-none px-3 py-2 text-[13px] font-semibold text-ink">{title}</summary>
      <div className="border-t border-hairline p-2">
        <AgentJsonBlock value={item} />
      </div>
    </details>
  );
}

function readRuntimeArtifact(item: unknown): null | {
  agentName?: string;
  contentMarkdown?: string;
  rows: Array<{ label: string; value: string }>;
  sourceSeq?: number;
  summary?: string;
  title: string;
  type: "action_plan" | "analysis" | "report" | "submission" | "thesis";
} {
  const runtimeEvent = readPath(item, ["runtime_event"]) ?? readPath(item, ["payload", "runtime_event"]);
  const contentJson = readPath(runtimeEvent, ["content", "json"]);
  const rawArtifact = readPath(runtimeEvent, ["raw", "artifact"]);
  const artifact = isRecord(contentJson) ? contentJson : isRecord(rawArtifact) ? rawArtifact : null;
  if (!artifact) return null;
  const nestedArtifact = isRecord(readPath(artifact, ["artifact"])) ? (readPath(artifact, ["artifact"]) as Record<string, unknown>) : artifact;
  const payload = isRecord(readPath(artifact, ["payload"])) ? (readPath(artifact, ["payload"]) as Record<string, unknown>) : {};
  const type = normalizeArtifactType(readPath(nestedArtifact, ["artifact_type"]) ?? readPath(nestedArtifact, ["type"]) ?? readPath(artifact, ["kind"]) ?? readPath(nestedArtifact, ["kind"]));
  return {
    agentName: stringOrUndefined(readPath(nestedArtifact, ["agent_display_name"]) ?? readPath(nestedArtifact, ["agent_name"])),
    contentMarkdown: stringOrUndefined(readPath(nestedArtifact, ["content_markdown"]) ?? readPath(nestedArtifact, ["markdown"]) ?? readPath(nestedArtifact, ["content"])),
    rows: artifactRows(type, payload),
    sourceSeq: typeof readPath(nestedArtifact, ["source_seq"]) === "number" ? (readPath(nestedArtifact, ["source_seq"]) as number) : undefined,
    summary: stringOrUndefined(readPath(nestedArtifact, ["summary"]) ?? readPath(payload, ["summary"]) ?? readPath(payload, ["reason_summary"])),
    title: stringOrUndefined(readPath(nestedArtifact, ["title"])) ?? artifactTitle(type),
    type,
  };
}

function normalizeArtifactType(value: unknown): "action_plan" | "analysis" | "report" | "submission" | "thesis" {
  if (value === "report") return "report";
  if (value === "thesis_evaluation") return "thesis";
  if (value === "action_plan") return "action_plan";
  if (value === "submission_result") return "submission";
  return "analysis";
}

function artifactTitle(type: "action_plan" | "analysis" | "report" | "submission" | "thesis") {
  if (type === "thesis") return "Thesis 评估";
  if (type === "action_plan") return "ActionPlan";
  if (type === "submission") return "行动提交结果";
  if (type === "report") return "分析报告";
  return "运行产物";
}

function artifactRows(type: "action_plan" | "analysis" | "report" | "submission" | "thesis", payload: Record<string, unknown>) {
  if (type === "report") return [];
  if (type === "thesis") {
    return compactRows([
      ["建议", readPath(payload, ["suggested_intent"])],
      ["置信度", percentValue(readPath(payload, ["confidence_score"]))],
      ["风险", readPath(payload, ["risk_level"])],
      ["关系", readPath(payload, ["event_relationship"])],
    ]);
  }
  if (type === "action_plan") {
    const orders = readPath(payload, ["orders"]);
    const firstOrder = Array.isArray(orders) && isRecord(orders[0]) ? orders[0] : {};
    const riskControls = isRecord(readPath(payload, ["risk_controls"])) ? (readPath(payload, ["risk_controls"]) as Record<string, unknown>) : {};
    return compactRows([
      ["动作", readPath(payload, ["intended_action"])],
      ["标的", Array.isArray(readPath(payload, ["target_symbols"])) ? (readPath(payload, ["target_symbols"]) as unknown[]).join(", ") : readPath(payload, ["target_symbols"])],
      ["规模", currencyValue(readPath(firstOrder, ["notional_usd"]))],
      ["止损", percentValue(readPath(riskControls, ["stop_loss_pct"]))],
      ["止盈", percentValue(readPath(riskControls, ["take_profit_pct"]))],
    ]);
  }
  if (type === "submission") {
    return compactRows([
      ["模式", readPath(payload, ["resolved_mode"])],
      ["执行", readPath(payload, ["execution_status"])],
      ["通知", readPath(payload, ["notification_status"])],
      ["监控", readPath(payload, ["monitoring_status"])],
    ]);
  }
  return [];
}

function compactRows(items: Array<[string, unknown]>): Array<{ label: string; value: string }> {
  return items
    .map(([label, value]) => ({ label, value: stringOrUndefined(value) ?? "" }))
    .filter((row) => row.value.length > 0);
}

function percentValue(value: unknown): string | undefined {
  if (typeof value !== "number") return stringOrUndefined(value);
  const scaled = Math.abs(value) <= 1 ? value * 100 : value;
  return `${Number(scaled.toFixed(1))}%`;
}

function currencyValue(value: unknown): string | undefined {
  if (typeof value !== "number") return stringOrUndefined(value);
  return new Intl.NumberFormat("zh-CN", { currency: "USD", maximumFractionDigits: 0, style: "currency" }).format(value);
}

function RuntimeEventRow({ item }: { item: unknown }) {
  return (
    <div className="grid gap-1 rounded-md border border-hairline bg-canvas px-3 py-2 text-[12px]">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-semibold text-ink">{runtimeTitle(item, "event")}</span>
        <span className="font-mono text-[11px] text-muted">{String(readPath(item, ["seq"]) ?? "")}</span>
      </div>
      <div className="line-clamp-2 break-words text-muted-strong">{String(readPath(item, ["content"]) ?? readPath(item, ["type"]) ?? "")}</div>
    </div>
  );
}

function PanelHeader({ icon, meta, title }: { icon: ReactNode; meta?: string; title: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-[12px] font-bold uppercase text-muted-strong">
        {icon}
        <span>{title}</span>
      </div>
      {meta ? <span className="rounded bg-canvas px-2 py-0.5 font-mono text-[11px] text-muted">{meta}</span> : null}
    </div>
  );
}

function RuntimeBadge({ status }: { status: string }) {
  const className =
    status === "completed" || status === "success"
      ? "bg-trading-up/10 text-trading-up"
      : status === "failed" || status === "error"
        ? "bg-danger/10 text-danger"
        : status === "running" || status === "in_progress" || status === "started"
          ? "bg-primary/10 text-primary"
          : "bg-surface-soft text-muted-strong";
  return <span className={`shrink-0 rounded px-2 py-0.5 font-mono text-[11px] ${className}`}>{status}</span>;
}

function EmptyRuntimeText({ children }: { children: ReactNode }) {
  return <div className="mt-3 rounded-md border border-dashed border-hairline bg-canvas px-3 py-4 text-center text-[12px] text-muted-strong">{children}</div>;
}

function todoStats(items: readonly unknown[]) {
  const done = items.filter((item) => normalizedStatus(readPath(item, ["status"]) ?? readPath(item, ["state"])) === "completed").length;
  return {
    done,
    percent: items.length ? Math.round((done / items.length) * 100) : 0,
  };
}

function runtimeTitle(item: unknown, fallback: string): string {
  return String(
    readPath(item, ["payload", "name"]) ??
      readPath(item, ["payload", "tool_name"]) ??
      readPath(item, ["payload", "tool_id"]) ??
      readPath(item, ["payload", "artifact_id"]) ??
      readPath(item, ["type"]) ??
      readPath(item, ["name"]) ??
      fallback,
  );
}

function normalizedStatus(value: unknown): string {
  const raw = String(value ?? "pending").toLowerCase();
  if (raw.includes("completed") || raw.includes("finished") || raw.includes("success")) return "completed";
  if (raw.includes("fail") || raw.includes("error")) return "failed";
  if (raw.includes("running") || raw.includes("started") || raw.includes("progress")) return "running";
  return raw;
}

function readPath(value: unknown, path: string[]): unknown {
  let cursor = value;
  for (const key of path) {
    if (!cursor || typeof cursor !== "object" || !(key in cursor)) return undefined;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return cursor;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function itemKey(item: unknown, index: number): string {
  return String(readPath(item, ["event_id"]) ?? readPath(item, ["id"]) ?? readPath(item, ["tool_call_id"]) ?? index);
}

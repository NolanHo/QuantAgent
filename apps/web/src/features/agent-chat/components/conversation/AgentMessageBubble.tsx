import { AlertTriangle, Bot, Brain, CheckSquare, FileText, Hammer, RadioTower, TerminalSquare, User, Workflow } from "lucide-react";
import type { ReactNode } from "react";

import type { AgentChatTimelineItem } from "../../types";
import { AgentJsonBlock } from "../events/AgentJsonBlock";
import { AgentMarkdown } from "./AgentMarkdown";

export type AgentTimelineDisplayItem = AgentChatTimelineItem;

export function AgentMessageBubble({ message }: { message: AgentTimelineDisplayItem }) {
  if (isRuntimeTimelineItem(message)) {
    return <RuntimeTimelineCard message={message} />;
  }

  const type = normalizeMessageType(message.role || message.type);
  const isUser = type === "human";
  const title = isUser ? "user" : message.kind === "final" ? "final" : "assistant";
  return (
    <article className={`group flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser ? <MessageAvatar type={type} /> : null}
      <div className={`grid max-w-[min(760px,100%)] gap-1 ${isUser ? "justify-items-end" : "justify-items-start"}`}>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase text-muted-strong">
          <span>{title}</span>
          {message.id ? <span className="font-mono normal-case text-muted">{message.id}</span> : null}
        </div>
        <div
          className={[
            "rounded-lg border px-4 py-3 text-[14px] leading-6 shadow-sm",
            isUser
              ? "border-primary/20 bg-primary text-on-primary"
              : type === "system"
                ? "border-warning/30 bg-warning/10 text-ink"
                : "border-hairline bg-canvas text-ink",
          ].join(" ")}
        >
          {isUser ? <p className="m-0 whitespace-pre-wrap">{message.content || " "}</p> : <AgentMarkdown content={message.content || " "} />}
        </div>
      </div>
      {isUser ? <MessageAvatar type={type} /> : null}
    </article>
  );
}

function RuntimeTimelineCard({ message }: { message: AgentTimelineDisplayItem }) {
  const meta = runtimeMeta(message);
  return (
    <article className="flex justify-start gap-3">
      <div className={`mt-1 grid size-8 shrink-0 place-items-center rounded-md border ${meta.avatarClass}`}>{meta.icon}</div>
      <div className="grid max-w-[min(820px,100%)] gap-1">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase text-muted-strong">
          <span>{meta.title}</span>
          <span className="font-mono normal-case text-muted">{message.type ?? message.kind}</span>
          <span className="font-mono normal-case text-muted">seq {message.seq}</span>
        </div>
        <details className={`group rounded-lg border ${meta.cardClass}`} open={message.kind !== "system_event"}>
          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="break-words text-[14px] font-semibold leading-5 text-ink">{message.content || meta.fallback}</div>
              <div className="mt-1 font-mono text-[11px] text-muted">{message.id}</div>
            </div>
            <span className="rounded-md border border-hairline bg-canvas px-2 py-1 text-[11px] font-semibold text-muted-strong">
              JSON
            </span>
          </summary>
          <div className="border-t border-hairline p-3">
            <AgentJsonBlock value={message} />
          </div>
        </details>
      </div>
    </article>
  );
}

function MessageAvatar({ type }: { type: string }) {
  const Icon = type === "human" ? User : type === "system" || type === "tool" ? TerminalSquare : Bot;
  return (
    <div className="mt-5 grid size-8 shrink-0 place-items-center rounded-md border border-hairline bg-surface-soft text-muted-strong">
      <Icon aria-hidden className="size-4" />
    </div>
  );
}

function normalizeMessageType(type: string | undefined): string {
  if (type === "human" || type === "user") return "human";
  if (type === "ai" || type === "assistant") return "ai";
  return type ?? "ai";
}

function isRuntimeTimelineItem(message: AgentTimelineDisplayItem): boolean {
  return !["message", "final"].includes(message.kind) && message.role !== "user";
}

function runtimeMeta(message: AgentTimelineDisplayItem): {
  avatarClass: string;
  cardClass: string;
  fallback: string;
  icon: ReactNode;
  title: string;
} {
  if (message.kind === "reasoning") {
    return {
      avatarClass: "border-primary/20 bg-primary/10 text-primary",
      cardClass: "border-primary/20 bg-primary/5",
      fallback: "Reasoning chunk received.",
      icon: <Brain aria-hidden className="size-4" />,
      title: "reasoning",
    };
  }
  if (message.kind === "tool") {
    return {
      avatarClass: "border-hairline bg-surface-soft text-muted-strong",
      cardClass: "border-hairline bg-canvas",
      fallback: "Tool event received.",
      icon: <Hammer aria-hidden className="size-4" />,
      title: "tool",
    };
  }
  if (message.kind === "todo") {
    return {
      avatarClass: "border-hairline bg-surface-soft text-muted-strong",
      cardClass: "border-hairline bg-surface-soft",
      fallback: "Todo updated.",
      icon: <CheckSquare aria-hidden className="size-4" />,
      title: "todo",
    };
  }
  if (message.kind === "subagent") {
    return {
      avatarClass: "border-hairline bg-surface-soft text-muted-strong",
      cardClass: "border-hairline bg-canvas",
      fallback: "SubAgent event received.",
      icon: <Workflow aria-hidden className="size-4" />,
      title: "subagent",
    };
  }
  if (message.kind === "artifact") {
    return {
      avatarClass: "border-hairline bg-surface-soft text-muted-strong",
      cardClass: "border-hairline bg-canvas",
      fallback: "Artifact updated.",
      icon: <FileText aria-hidden className="size-4" />,
      title: "artifact",
    };
  }
  if (message.kind === "interrupt" || message.kind === "error") {
    return {
      avatarClass: "border-warning/30 bg-warning/10 text-warning",
      cardClass: "border-warning/30 bg-warning/10",
      fallback: message.kind === "error" ? "Agent run failed." : "Human approval requested.",
      icon: <AlertTriangle aria-hidden className="size-4" />,
      title: message.kind === "error" ? "error" : "interrupt",
    };
  }
  return {
    avatarClass: "border-hairline bg-surface-soft text-muted-strong",
    cardClass: "border-hairline bg-canvas",
    fallback: "Runtime event received.",
    icon: <RadioTower aria-hidden className="size-4" />,
    title: "runtime",
  };
}

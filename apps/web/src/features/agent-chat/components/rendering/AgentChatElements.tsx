import { ChevronDown, Download, MessageSquare } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { twMerge } from "tailwind-merge";

import { AgentMarkdown } from "../conversation/AgentMarkdown";

export function Conversation({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={twMerge("relative min-h-0 overflow-hidden", className)}>{children}</section>;
}

export function ConversationContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={twMerge("grid min-h-0 content-start gap-5 overflow-auto px-1 py-2", className)}>{children}</div>;
}

export function ConversationEmptyState({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="grid min-h-80 place-items-center rounded-lg border border-dashed border-hairline bg-canvas p-8 text-center">
      <div className="grid max-w-sm justify-items-center gap-2">
        <MessageSquare aria-hidden className="size-10 text-muted" />
        <div className="text-title-sm font-bold text-ink">{title}</div>
        <div className="text-body-sm text-muted-strong">{description}</div>
      </div>
    </div>
  );
}

export function ConversationDownload({ content, filename = "agent-chat.md" }: { content: string; filename?: string }) {
  return (
    <button
      className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-md border border-hairline bg-canvas text-muted-strong shadow-card transition-colors hover:border-primary hover:text-primary"
      onClick={() => downloadText(filename, content)}
      title="下载 Markdown"
      type="button"
    >
      <Download aria-hidden className="size-4" />
    </button>
  );
}

export function Message({
  children,
  from,
  meta,
  title,
}: {
  children: ReactNode;
  from: "assistant" | "system" | "tool" | "user";
  meta?: string;
  title?: string;
}) {
  const isUser = from === "user";
  return (
    <article className={twMerge("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser ? <MessageAvatar from={from} /> : null}
      <div className={twMerge("grid max-w-[min(860px,100%)] gap-2", isUser ? "justify-items-end" : "justify-items-start")}>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase text-muted-strong">
          <span>{title ?? from}</span>
          {meta ? <span className="font-mono normal-case text-muted">{meta}</span> : null}
        </div>
        <MessageContent from={from}>{children}</MessageContent>
      </div>
      {isUser ? <MessageAvatar from={from} /> : null}
    </article>
  );
}

export function MessageContent({ children, from }: { children: ReactNode; from: "assistant" | "system" | "tool" | "user" }) {
  if (from === "user") {
    return <div className="rounded-lg border border-primary/20 bg-primary px-4 py-3 text-body-md leading-6 text-on-primary shadow-card">{children}</div>;
  }
  return <div className="grid w-full gap-3 rounded-lg border border-hairline bg-canvas px-4 py-3 text-body-md leading-6 text-ink shadow-card">{children}</div>;
}

export function MessageResponse({ children }: { children: string }) {
  return <AgentMarkdown content={children} />;
}

export function Reasoning({
  children,
  durationSeconds,
  isStreaming = false,
  title = "推理过程",
}: {
  children: string;
  durationSeconds?: number;
  isStreaming?: boolean;
  title?: string;
}) {
  const [open, setOpen] = useState(isStreaming);
  const subtitle = isStreaming ? "thinking..." : durationSeconds ? `${durationSeconds}s` : "completed";
  return (
    <details
      className="rounded-lg border border-primary/20 bg-primary/5"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2">
        <div className="min-w-0">
          <div className="text-body-sm font-bold text-ink">{title}</div>
          <div className="text-caption font-semibold text-primary">{subtitle}</div>
        </div>
        <ChevronDown aria-hidden className={twMerge("size-4 shrink-0 text-muted transition-transform", open ? "rotate-180" : "")} />
      </summary>
      <div className="border-t border-primary/10 px-3 py-3 text-body-sm text-muted-strong">
        <AgentMarkdown content={children} />
      </div>
    </details>
  );
}

function MessageAvatar({ from }: { from: "assistant" | "system" | "tool" | "user" }) {
  const label = from === "assistant" ? "AI" : from === "user" ? "U" : from === "tool" ? "T" : "S";
  return (
    <div className="mt-5 grid size-8 shrink-0 place-items-center rounded-md border border-hairline bg-surface-soft text-[11px] font-black text-muted-strong">
      {label}
    </div>
  );
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function useConversationMarkdown(messages: Array<{ role: string; parts: Array<{ text?: string; type: string }> }>) {
  return useMemo(
    () =>
      messages
        .map((message) => {
          const body = message.parts
            .map((part) => (part.type === "text" || part.type === "reasoning" ? part.text : ""))
            .filter(Boolean)
            .join("\n\n");
          return `## ${message.role}\n\n${body}`;
        })
        .join("\n\n"),
    [messages],
  );
}

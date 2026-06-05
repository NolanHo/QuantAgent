import type {
  AgentArtifactPart,
  AgentChatTimelineItem,
  AgentRenderMessage,
  AgentRenderPart,
  AgentTaskItem,
  AgentToolPart,
} from "../types";

export function agentTimelineToRenderMessages(timeline: readonly AgentChatTimelineItem[]): AgentRenderMessage[] {
  const sorted = [...timeline].sort(compareTimelineItems);
  const messages: AgentRenderMessage[] = [];
  const assistantByRun = new Map<string, AgentRenderMessage>();

  for (const item of sorted) {
    if (item.role === "user" || item.kind === "message" && item.role === "user") {
      messages.push({
        id: item.id,
        createdAt: item.createdAt,
        role: "user",
        title: "user",
        parts: [{ type: "text", text: item.content }],
      });
      continue;
    }

    const assistant = getAssistantMessage(messages, assistantByRun, item);
    mergeTimelineItemIntoAssistant(assistant, item);
  }

  return messages.filter((message) => message.parts.length > 0);
}

function compareTimelineItems(left: AgentChatTimelineItem, right: AgentChatTimelineItem): number {
  const leftSeq = Number.isFinite(left.seq) ? left.seq : Number.MAX_SAFE_INTEGER;
  const rightSeq = Number.isFinite(right.seq) ? right.seq : Number.MAX_SAFE_INTEGER;
  if (leftSeq !== rightSeq) return leftSeq - rightSeq;
  return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
}

function getAssistantMessage(
  messages: AgentRenderMessage[],
  assistantByRun: Map<string, AgentRenderMessage>,
  item: AgentChatTimelineItem,
): AgentRenderMessage {
  const key = item.runId ?? item.agentRunId ?? item.traceId ?? "agent-chat-runtime";
  const existing = assistantByRun.get(key);
  if (existing) return existing;

  const message: AgentRenderMessage = {
    id: `assistant_${key}`,
    createdAt: item.createdAt,
    role: "assistant",
    title: "Semiconductor MainAgent",
    meta: item.runId ?? item.agentRunId ?? undefined,
    parts: [],
  };
  assistantByRun.set(key, message);
  messages.push(message);
  return message;
}

function mergeTimelineItemIntoAssistant(message: AgentRenderMessage, item: AgentChatTimelineItem): void {
  if (item.kind === "delta" || item.kind === "final" || item.kind === "message") {
    upsertTextPart(message.parts, item.content, item.role === "assistant" ? "response" : "process");
    return;
  }

  if (item.kind === "reasoning") {
    upsertReasoningPart(message.parts, item.content, item.type);
    return;
  }

  if (item.kind === "tool") {
    upsertToolPart(message.parts, timelineItemToToolPart(item));
    return;
  }

  if (item.kind === "todo") {
    upsertTasksPart(message.parts, timelineItemToTasks(item));
    return;
  }

  if (item.kind === "artifact") {
    message.parts.push(timelineItemToArtifact(item));
    return;
  }

  if (item.kind === "interrupt" || item.kind === "error") {
    message.parts.push({
      type: "notice",
      title: item.kind === "error" ? "运行失败" : "需要人工处理",
      tone: item.kind === "error" ? "danger" : "warning",
      text: item.content,
    });
    return;
  }

  if (item.content) {
    message.parts.push({
      type: "notice",
      title: readableEventTitle(item.kind),
      tone: "neutral",
      text: item.content,
    });
  }
}

function upsertTextPart(parts: AgentRenderPart[], text: string, display: "process" | "response" = "process"): void {
  if (!text) return;
  const existing = parts.find((part) => part.type === "text" && part.display === display);
  if (existing?.type === "text") {
    existing.text = text.length >= existing.text.length ? text : existing.text;
    return;
  }
  parts.push({ type: "text", display, text });
}

function upsertReasoningPart(parts: AgentRenderPart[], text: string, eventType?: string): void {
  if (!text) return;
  const existing = parts.find((part) => part.type === "reasoning");
  if (existing?.type === "reasoning") {
    if (!existing.text.includes(text)) existing.text = `${existing.text}\n\n${text}`;
    existing.status = eventType?.includes("completed") ? "completed" : existing.status ?? "completed";
    return;
  }
  parts.push({
    type: "reasoning",
    title: "推理过程",
    status: eventType?.includes("streaming") ? "streaming" : "completed",
    text,
  });
}

function upsertToolPart(parts: AgentRenderPart[], next: AgentToolPart): void {
  const index = parts.findIndex((part) => part.type === "tool" && part.callId === next.callId);
  if (index < 0) {
    parts.push(next);
    return;
  }
  const current = parts[index];
  if (current?.type !== "tool") return;
  parts[index] = {
    ...current,
    ...next,
    description: next.description ?? current.description,
    input: mergeToolInput(current.input, next.input),
    output: next.output ?? current.output,
    status: next.status,
  };
}

function mergeToolInput(
  current: Record<string, unknown> | undefined,
  next: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!current) return next;
  if (!next) return current;
  return { ...current, ...next };
}

function upsertTasksPart(parts: AgentRenderPart[], tasks: AgentTaskItem[]): void {
  if (!tasks.length) return;
  const existing = parts.find((part) => part.type === "tasks");
  if (existing?.type === "tasks") {
    existing.tasks = tasks;
    return;
  }
  parts.push({ type: "tasks", title: "运行计划", tasks });
}

function timelineItemToToolPart(item: AgentChatTimelineItem): AgentToolPart {
  const identity = readToolIdentity(item.payload);
  const status = item.type === "tool.started" ? "running" : item.type === "tool.failed" ? "error" : "completed";
  const output = status === "running" ? undefined : readToolOutput(item);
  return {
    type: "tool",
    callId: identity.callId ?? item.id,
    name: identity.toolName ?? "tool",
    status,
    description: status === "running" ? item.content : undefined,
    input: status === "running" ? compactToolInput(item.payload) : undefined,
    output,
  };
}

function readToolIdentity(payload: Record<string, unknown>): { callId: null | string; toolName: null | string } {
  const message = isRecord(payload.message) ? payload.message : null;
  return {
    callId: readString(payload.invocation_id) ?? readString(payload.tool_call_id) ?? readString(payload.call_id) ?? readString(message?.tool_call_id) ?? readString(message?.id),
    toolName: readString(payload.tool_name) ?? readString(payload.tool_id) ?? readString(payload.name) ?? readString(message?.name) ?? readString(message?.tool_name) ?? readString(message?.tool_id),
  };
}

function compactToolInput(payload: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of ["query", "symbol", "symbols", "window", "tool_id", "name"]) {
    const value = payload[key];
    if (isPrimitive(value)) result[key] = value;
  }
  return result;
}

function readToolOutput(item: AgentChatTimelineItem): string | undefined {
  const message = isRecord(item.payload.message) ? item.payload.message : null;
  const content = readString(message?.content) ?? item.content;
  if (!content || content.startsWith("Tool ") && content.endsWith(".")) return undefined;
  return content;
}

function timelineItemToTasks(item: AgentChatTimelineItem): AgentTaskItem[] {
  const raw = Array.isArray(item.payload.todos) ? item.payload.todos : [];
  return raw
    .map((todo, index): AgentTaskItem | null => {
      if (!isRecord(todo)) return null;
      const label = readString(todo.label) ?? readString(todo.content) ?? readString(todo.title);
      if (!label) return null;
      return {
        id: readString(todo.id) ?? `todo_${index}`,
        label,
        description: readString(todo.description) ?? undefined,
        status: normalizeTaskStatus(readString(todo.status)),
      };
    })
    .filter((task): task is AgentTaskItem => Boolean(task));
}

function timelineItemToArtifact(item: AgentChatTimelineItem): AgentArtifactPart {
  return {
    type: "artifact",
    artifactType: "analysis",
    title: readableEventTitle(item.kind),
    tone: "info",
    rows: objectRows(item.payload).length ? objectRows(item.payload) : [{ label: "内容", value: item.content }],
  };
}

function objectRows(payload: Record<string, unknown>): Array<{ label: string; value: string }> {
  return Object.entries(payload)
    .filter(([, value]) => isPrimitive(value))
    .slice(0, 6)
    .map(([label, value]) => ({ label, value: String(value) }));
}

function normalizeTaskStatus(status: null | string): AgentTaskItem["status"] {
  if (status === "completed" || status === "done" || status === "success") return "completed";
  if (status === "error" || status === "failed") return "error";
  if (status === "in_progress" || status === "running") return "in_progress";
  return "pending";
}

function readableEventTitle(kind: string): string {
  if (kind === "artifact") return "运行产物";
  if (kind === "system_event") return "运行事件";
  return kind;
}

function readString(value: unknown): null | string {
  return typeof value === "string" && value ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPrimitive(value: unknown): value is boolean | number | string {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

import type { AgentServerAdapter } from "@langchain/langgraph-sdk";

import type { ApiClient } from "@/shared/api";

import type { AgentChatStreamEvent } from "./agent-chat.contracts";
import { streamAgentChatMessage } from "./agent-chat.stream";

interface AgentChatRuntimeTransportOptions {
  apiClient: ApiClient;
  sessionId: string;
  threadId: string;
}

type AgentServerCommand = Parameters<AgentServerAdapter["send"]>[0];
type AgentServerSendResult = Awaited<ReturnType<AgentServerAdapter["send"]>>;
type EventStreamHandle = ReturnType<NonNullable<AgentServerAdapter["openEventStream"]>>;
type SubscribeParams = Parameters<NonNullable<AgentServerAdapter["openEventStream"]>>[0];
type AgentServerEvent = EventStreamHandle["events"] extends AsyncIterable<infer T> ? T : never;

type QueuedResult<T> =
  | { done: false; value: T }
  | { done: true; value: undefined };

class AsyncEventQueue<T> implements AsyncIterable<T> {
  private readonly items: T[] = [];
  private readonly waiters: Array<(result: QueuedResult<T>) => void> = [];
  private closed = false;

  push(item: T): void {
    if (this.closed) return;
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter({ done: false, value: item });
      return;
    }
    this.items.push(item);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    while (this.waiters.length) {
      this.waiters.shift()?.({ done: true, value: undefined });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        const item = this.items.shift();
        if (item) return Promise.resolve({ done: false, value: item });
        if (this.closed) return Promise.resolve({ done: true, value: undefined });
        return new Promise<QueuedResult<T>>((resolve) => this.waiters.push(resolve));
      },
      return: () => {
        this.close();
        return Promise.resolve({ done: true, value: undefined });
      },
    };
  }
}

export class AgentChatRuntimeTransport implements AgentServerAdapter {
  readonly threadId: string;

  private readonly apiClient: ApiClient;
  private readonly sessionId: string;
  private readonly sinks = new Set<{ params: SubscribeParams; queue: AsyncEventQueue<AgentServerEvent> }>();
  private readonly replay: AgentServerEvent[] = [];
  private activeRunAbort: AbortController | null = null;
  private latestValues: Record<string, unknown> = { messages: [], timeline: [] };
  private seq = 0;

  constructor(options: AgentChatRuntimeTransportOptions) {
    this.apiClient = options.apiClient;
    this.sessionId = options.sessionId;
    this.threadId = options.threadId;
  }

  async open(): Promise<void> {
    return Promise.resolve();
  }

  async send(command: AgentServerCommand): Promise<AgentServerSendResult> {
    if (command.method !== "run.start") {
      return protocolError(command.id, "not_supported", `${command.method} is not supported by Agent Chat MVP.`);
    }

    const runId = `agent_chat_ui_run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const message = extractUserMessage(command.params.input);
    this.startRun({ message, runId });

    return {
      id: command.id,
      result: { run_id: runId },
      type: "success",
    } as AgentServerSendResult;
  }

  events(): AsyncIterable<AgentServerEvent> {
    return new AsyncEventQueue<AgentServerEvent>();
  }

  openEventStream(params: SubscribeParams): EventStreamHandle {
    const queue = new AsyncEventQueue<AgentServerEvent>();
    const sink = { params, queue };
    this.sinks.add(sink);

    for (const event of this.replay) {
      if (matchesSubscribeParams(event, params)) queue.push(event);
    }

    return {
      close: () => {
        this.sinks.delete(sink);
        queue.close();
      },
      events: queue,
      ready: Promise.resolve(),
    };
  }

  async close(): Promise<void> {
    this.activeRunAbort?.abort();
    for (const sink of this.sinks) sink.queue.close();
    this.sinks.clear();
  }

  async getState<StateType = unknown>(): Promise<{ values: StateType } | null> {
    return { values: this.latestValues as StateType };
  }

  private startRun({ message, runId }: { message: string; runId: string }): void {
    this.activeRunAbort?.abort();
    const abortController = new AbortController();
    this.activeRunAbort = abortController;

    const humanMessageId = `human_${runId}`;
    const createdAt = new Date().toISOString();
    this.latestValues = {
      ...this.latestValues,
      messages: [
        ...(Array.isArray(this.latestValues.messages) ? this.latestValues.messages : []),
        { content: message, id: humanMessageId, type: "human" },
      ],
      timeline: appendTimelineItem(this.latestValues.timeline, {
        content: message,
        createdAt,
        id: humanMessageId,
        kind: "message",
        payload: {},
        role: "user",
        runId,
        seq: this.nextSeq(),
        traceId: null,
        type: "message.local",
      }),
      session_id: this.sessionId,
    };
    this.publish(valuesEvent(this.latestValues, this.nextSeq()));
    this.publish(lifecycleEvent("running", runId, this.nextSeq()));

    void (async () => {
      const assistantMessageId = `ai_${runId}`;
      let assistantStarted = false;
      let assistantText = "";

      try {
        for await (const rawEvent of streamAgentChatMessage({
          apiClient: this.apiClient,
          request: { message },
          sessionId: this.sessionId,
          signal: abortController.signal,
        })) {
          if (rawEvent.type === "message.appended") {
            this.updateMetadata(rawEvent);
            continue;
          }

          if (rawEvent.kind === "delta") {
            if (!assistantStarted) {
              assistantStarted = true;
              this.publish(messageStartEvent({ messageId: assistantMessageId, role: "ai", runId, seq: this.nextSeq() }));
              this.publish(contentBlockStartEvent({ messageId: assistantMessageId, runId, seq: this.nextSeq() }));
            }
            assistantText += rawEvent.content;
            this.publish(contentDeltaEvent({ delta: rawEvent.content, messageId: assistantMessageId, runId, seq: this.nextSeq() }));
            this.updateValues(assistantMessageId, assistantText, rawEvent);
            continue;
          }

          if (rawEvent.kind === "final") {
            if (!assistantStarted) {
              assistantStarted = true;
              this.publish(messageStartEvent({ messageId: assistantMessageId, role: "ai", runId, seq: this.nextSeq() }));
              this.publish(contentBlockStartEvent({ messageId: assistantMessageId, runId, seq: this.nextSeq() }));
            }
            if (rawEvent.content && rawEvent.content !== assistantText) {
              const nextDelta = rawEvent.content.startsWith(assistantText) ? rawEvent.content.slice(assistantText.length) : rawEvent.content;
              assistantText = rawEvent.content;
              if (nextDelta) this.publish(contentDeltaEvent({ delta: nextDelta, messageId: assistantMessageId, runId, seq: this.nextSeq() }));
            }
            this.updateValues(assistantMessageId, assistantText, rawEvent);
            continue;
          }

          this.updateRuntimeEvent(rawEvent);
          if (rawEvent.kind === "tool") {
            const event = toolEvent(rawEvent, runId, this.nextSeq());
            if (event) this.publish(event);
          }
          if (rawEvent.kind === "todo") this.updateTodos(rawEvent);
          if (rawEvent.kind === "subagent") this.updateNamedList("subagents", rawEvent);
          if (rawEvent.kind === "artifact") this.updateNamedList("artifacts", rawEvent);
          if (rawEvent.kind === "interrupt") this.publish(interruptEvent(rawEvent, runId, this.nextSeq()));
          if (rawEvent.kind === "error") throw new Error(rawEvent.content || "Agent Chat stream failed.");
        }

        if (assistantStarted) {
          this.publish(contentBlockFinishEvent({ content: assistantText, messageId: assistantMessageId, runId, seq: this.nextSeq() }));
          this.publish(messageFinishEvent({ messageId: assistantMessageId, runId, seq: this.nextSeq() }));
        }
        this.publish(lifecycleEvent("completed", runId, this.nextSeq()));
      } catch (error) {
        if (abortController.signal.aborted) {
          this.publish(lifecycleEvent("interrupted", runId, this.nextSeq()));
          return;
        }
        this.publish(lifecycleEvent("failed", runId, this.nextSeq(), error instanceof Error ? error.message : "Agent Chat stream failed."));
      }
    })();
  }

  private nextSeq(): number {
    this.seq += 1;
    return this.seq;
  }

  private publish(event: AgentServerEvent): void {
    this.replay.push(event);
    for (const sink of this.sinks) {
      if (matchesSubscribeParams(event, sink.params)) sink.queue.push(event);
    }
  }

  private updateValues(messageId: string, assistantText: string, rawEvent: AgentChatStreamEvent): void {
    const messages = upsertMessage(this.latestValues.messages, {
      content: assistantText,
      id: messageId,
      type: "ai",
    });
    this.latestValues = {
      ...this.latestValues,
      messages,
      timeline: upsertTimelineItem(this.latestValues.timeline, {
        agentRunId: rawEvent.agent_run_id,
        content: assistantText,
        createdAt: rawEvent.created_at,
        id: messageId,
        kind: rawEvent.kind === "final" ? "final" : "message",
        payload: rawEvent.payload,
        role: "assistant",
        runId: rawEvent.run_id,
        seq: rawEvent.seq ?? this.seq,
        traceId: rawEvent.trace_id,
        type: rawEvent.type,
      }),
      session_id: rawEvent.session_id,
      trace_id: rawEvent.trace_id,
    };
    this.publish(valuesEvent(this.latestValues, this.nextSeq()));
  }

  private updateMetadata(rawEvent: AgentChatStreamEvent): void {
    this.latestValues = {
      ...this.latestValues,
      session_id: rawEvent.session_id,
      trace_id: rawEvent.trace_id,
    };
    this.publish(valuesEvent(this.latestValues, this.nextSeq()));
  }

  private updateTodos(rawEvent: AgentChatStreamEvent): void {
    const todos = Array.isArray(rawEvent.payload.todos) ? rawEvent.payload.todos : [rawEvent.payload];
    this.latestValues = {
      ...this.latestValues,
      todos,
    };
    this.publish(valuesEvent(this.latestValues, this.nextSeq()));
  }

  private updateNamedList(key: "artifacts" | "subagents", rawEvent: AgentChatStreamEvent): void {
    this.latestValues = {
      ...this.latestValues,
      [key]: upsertByEventId(this.latestValues[key], rawEvent),
    };
    this.publish(valuesEvent(this.latestValues, this.nextSeq()));
  }

  private updateRuntimeEvent(rawEvent: AgentChatStreamEvent): void {
    this.latestValues = {
      ...this.latestValues,
      runtime_events: mergeRuntimeEventIndex(this.latestValues.runtime_events, rawEvent),
      session_id: rawEvent.session_id,
      timeline: mergeTimelineEvent(this.latestValues.timeline, rawEvent),
      trace_id: rawEvent.trace_id,
    };
    if (rawEvent.kind === "tool") this.latestValues.tools = upsertByToolKey(this.latestValues.tools, rawEvent);
    if (rawEvent.kind === "interrupt") this.latestValues.interrupts = upsertByEventId(this.latestValues.interrupts, rawEvent);
    this.publish(valuesEvent(this.latestValues, this.nextSeq()));
  }
}

function protocolError(id: number, code: string, message: string): AgentServerSendResult {
  return { error: code, id, message, type: "error" } as AgentServerSendResult;
}

function extractUserMessage(input: unknown): string {
  if (input && typeof input === "object" && "messages" in input && Array.isArray(input.messages)) {
    for (const message of [...input.messages].reverse()) {
      if (!message || typeof message !== "object") continue;
      if (!("content" in message)) continue;
      const content = message.content;
      if (typeof content === "string" && content.trim()) return content.trim();
    }
  }
  return "分析这个事件，并给出面向调试的简洁结论。";
}

function upsertMessage(current: unknown, message: { content: string; id: string; type: "ai" | "human" }) {
  const messages = Array.isArray(current) ? current.slice() : [];
  const index = messages.findIndex((item) => item && typeof item === "object" && "id" in item && item.id === message.id);
  if (index >= 0) {
    messages[index] = message;
    return messages;
  }
  messages.push(message);
  return messages;
}

function upsertByEventId(current: unknown, event: AgentChatStreamEvent) {
  const items = Array.isArray(current) ? current.slice() : [];
  const index = items.findIndex((item) => item && typeof item === "object" && "event_id" in item && item.event_id === event.event_id);
  if (index >= 0) {
    items[index] = event;
    return items;
  }
  items.push(event);
  return items;
}

function mergeRuntimeEventIndex(current: unknown, event: AgentChatStreamEvent) {
  if (event.kind === "tool") {
    return upsertByStableKey(current, event, toolTimelineKey(event));
  }
  return upsertByEventId(current, event);
}

function upsertByStableKey(current: unknown, event: AgentChatStreamEvent, key: string) {
  const items = Array.isArray(current) ? current.slice() : [];
  const index = items.findIndex((item) => item && typeof item === "object" && stableEventKey(item as AgentChatStreamEvent) === key);
  const keyedEvent = { ...event, event_id: key };
  if (index >= 0) {
    items[index] = keyedEvent;
    return items;
  }
  items.push(keyedEvent);
  return items;
}

function stableEventKey(event: AgentChatStreamEvent): string {
  if (event.kind === "tool") return toolTimelineKey(event);
  return event.event_id;
}

function upsertByToolKey(current: unknown, event: AgentChatStreamEvent) {
  const items = Array.isArray(current) ? current.slice() : [];
  const key = toolTimelineKey(event);
  const index = items.findIndex((item) => item && typeof item === "object" && toolTimelineKey(item as AgentChatStreamEvent) === key);
  if (index >= 0) {
    items[index] = event;
    return items;
  }
  items.push(event);
  return items;
}

interface TimelineItem {
  agentRunId?: null | string;
  content: string;
  createdAt: string;
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  role: string;
  runId: null | string;
  seq: number;
  traceId?: null | string;
  type: string;
}

function appendTimelineItem(current: unknown, item: TimelineItem) {
  const items = Array.isArray(current) ? current.slice() : [];
  if (items.some((existing) => existing && typeof existing === "object" && "id" in existing && existing.id === item.id)) {
    return items;
  }
  items.push(item);
  return items;
}

function upsertTimelineItem(current: unknown, item: TimelineItem) {
  const items = Array.isArray(current) ? current.slice() : [];
  const index = items.findIndex((existing) => existing && typeof existing === "object" && "id" in existing && existing.id === item.id);
  if (index >= 0) {
    items[index] = item;
    return items;
  }
  items.push(item);
  return items;
}

function mergeTimelineEvent(current: unknown, rawEvent: AgentChatStreamEvent) {
  if (rawEvent.kind === "tool") {
    return upsertTimelineItemByKey(current, timelineItemFromRawEvent(rawEvent), toolTimelineKey(rawEvent));
  }
  return appendTimelineItem(current, timelineItemFromRawEvent(rawEvent));
}

function upsertTimelineItemByKey(current: unknown, item: TimelineItem, key: string) {
  const items = Array.isArray(current) ? current.slice() : [];
  const index = items.findIndex((existing) => existing && typeof existing === "object" && "id" in existing && existing.id === key);
  const keyedItem = { ...item, id: key };
  if (index >= 0) {
    items[index] = keyedItem;
    return items;
  }
  items.push(keyedItem);
  return items;
}

function timelineItemFromRawEvent(rawEvent: AgentChatStreamEvent): TimelineItem {
  return {
    agentRunId: rawEvent.agent_run_id,
    content: rawEvent.content,
    createdAt: rawEvent.created_at,
    id: rawEvent.event_id,
    kind: rawEvent.kind,
    payload: rawEvent.payload,
    role: rawEvent.role ?? eventRole(rawEvent),
    runId: rawEvent.run_id,
    seq: rawEvent.seq ?? 0,
    traceId: rawEvent.trace_id,
    type: rawEvent.type,
  };
}

function toolTimelineKey(rawEvent: AgentChatStreamEvent): string {
  const { callId, toolName } = readToolIdentity(rawEvent.payload ?? {});
  return `tool_${rawEvent.run_id ?? rawEvent.agent_run_id ?? rawEvent.session_id}_${callId ?? toolName ?? rawEvent.type}`;
}

function readToolIdentity(payload: Record<string, unknown>): { callId: null | string; toolName: null | string } {
  const message = payload.message && typeof payload.message === "object" ? (payload.message as Record<string, unknown>) : null;
  const raw = payload.raw && typeof payload.raw === "object" ? (payload.raw as Record<string, unknown>) : null;
  return {
    callId:
      readString(payload.invocation_id) ??
      readString(payload.tool_call_id) ??
      readString(payload.call_id) ??
      readString(message?.tool_call_id) ??
      readString(message?.id) ??
      readString(raw?.id) ??
      readString(raw?.tool_call_id) ??
      readFirstToolCallChunkId(payload) ??
      (message ? readFirstToolCallChunkId(message) : null),
    toolName:
      readString(payload.tool_name) ??
      readString(payload.name) ??
      readString(message?.name) ??
      readString(message?.tool_name) ??
      readString(raw?.name) ??
      readString(raw?.tool_name) ??
      readString(payload.tool_id) ??
      readString(message?.tool_id) ??
      readFirstToolCallChunkName(payload) ??
      (message ? readFirstToolCallChunkName(message) : null),
  };
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function readToolInput(payload: Record<string, unknown>): unknown {
  const direct = payload.input ?? payload.args;
  if (direct !== undefined) return parseMaybeJson(direct);
  const raw = payload.raw && typeof payload.raw === "object" ? (payload.raw as Record<string, unknown>) : null;
  const rawArgs = raw?.args ?? raw?.arguments ?? raw?.input;
  return rawArgs === undefined ? undefined : parseMaybeJson(rawArgs);
}

function readToolOutput(payload: Record<string, unknown>): unknown {
  const direct = payload.result ?? payload.output ?? payload.error;
  if (direct !== undefined) return parseMaybeJson(direct);
  const message = payload.message && typeof payload.message === "object" ? (payload.message as Record<string, unknown>) : null;
  return message?.content === undefined ? undefined : parseMaybeJson(message.content);
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

function readFirstToolCallChunkId(payload: Record<string, unknown>): string | null {
  const chunks = payload.tool_call_chunks ?? payload.tool_calls;
  if (!Array.isArray(chunks)) return null;
  const first = chunks[0];
  if (!first || typeof first !== "object") return null;
  const id = "id" in first ? first.id : "tool_call_id" in first ? first.tool_call_id : null;
  return typeof id === "string" && id ? id : null;
}

function readFirstToolCallChunkName(payload: Record<string, unknown>): string | null {
  const chunks = payload.tool_call_chunks ?? payload.tool_calls;
  if (!Array.isArray(chunks)) return null;
  const first = chunks[0];
  if (!first || typeof first !== "object") return null;
  const name = "name" in first ? first.name : null;
  return typeof name === "string" && name ? name : null;
}

function eventRole(rawEvent: AgentChatStreamEvent): string {
  if (rawEvent.kind === "tool") return "tool";
  if (rawEvent.kind === "subagent") return "subagent";
  return "assistant";
}

function matchesSubscribeParams(event: AgentServerEvent, params: SubscribeParams): boolean {
  if (!params.channels.includes(methodToChannel(event.method))) return false;
  const namespaces = params.namespaces;
  if (!namespaces?.length) return true;
  return namespaces.some((namespace) => namespaceMatches(event.params.namespace, namespace, params.depth));
}

function namespaceMatches(actual: readonly string[], prefix: readonly string[], depth?: number): boolean {
  if (prefix.length > actual.length) return false;
  if (!prefix.every((part, index) => actual[index] === part)) return false;
  return depth === null || depth === undefined || actual.length - prefix.length <= depth;
}

function methodToChannel(method: AgentServerEvent["method"]) {
  if (method === "input.requested") return "input";
  return method;
}

function now(): number {
  return Date.now();
}

function lifecycleEvent(status: "running" | "completed" | "failed" | "interrupted", runId: string, seq: number, error?: string): AgentServerEvent {
  return {
    event_id: `${runId}_lifecycle_${seq}`,
    method: "lifecycle",
    params: {
      data: { error, event: status, graph_name: "AgentChat" },
      namespace: [],
      timestamp: now(),
    },
    seq,
    type: "event",
  } as AgentServerEvent;
}

function messageStartEvent({
  messageId,
  role,
  runId,
  seq,
}: {
  messageId: string;
  role: "ai" | "human" | "system";
  runId: string;
  seq: number;
}): AgentServerEvent {
  return {
    event_id: `${runId}_${messageId}_start`,
    method: "messages",
    params: {
      data: { event: "message-start", id: messageId, role },
      namespace: [],
      timestamp: now(),
    },
    seq,
    type: "event",
  } as AgentServerEvent;
}

function contentBlockStartEvent({ messageId, runId, seq }: { messageId: string; runId: string; seq: number }): AgentServerEvent {
  return {
    event_id: `${runId}_${messageId}_block_start`,
    method: "messages",
    params: {
      data: { content: { text: "", type: "text" }, event: "content-block-start", index: 0 },
      namespace: [],
      timestamp: now(),
    },
    seq,
    type: "event",
  } as AgentServerEvent;
}

function contentDeltaEvent({ delta, messageId, runId, seq }: { delta: string; messageId: string; runId: string; seq: number }): AgentServerEvent {
  return {
    event_id: `${runId}_${messageId}_delta_${seq}`,
    method: "messages",
    params: {
      data: { delta: { text: delta, type: "text-delta" }, event: "content-block-delta", index: 0 },
      namespace: [],
      timestamp: now(),
    },
    seq,
    type: "event",
  } as AgentServerEvent;
}

function contentBlockFinishEvent({ content, messageId, runId, seq }: { content: string; messageId: string; runId: string; seq: number }): AgentServerEvent {
  return {
    event_id: `${runId}_${messageId}_block_finish`,
    method: "messages",
    params: {
      data: { content: { text: content, type: "text" }, event: "content-block-finish", index: 0 },
      namespace: [],
      timestamp: now(),
    },
    seq,
    type: "event",
  } as AgentServerEvent;
}

function messageFinishEvent({ messageId, runId, seq }: { messageId: string; runId: string; seq: number }): AgentServerEvent {
  return {
    event_id: `${runId}_${messageId}_finish`,
    method: "messages",
    params: {
      data: { event: "message-finish" },
      namespace: [],
      timestamp: now(),
    },
    seq,
    type: "event",
  } as AgentServerEvent;
}

function valuesEvent(values: Record<string, unknown>, seq: number): AgentServerEvent {
  return {
    event_id: `agent_chat_values_${seq}`,
    method: "values",
    params: {
      data: values,
      namespace: [],
      timestamp: now(),
    },
    seq,
    type: "event",
  } as AgentServerEvent;
}

function toolEvent(rawEvent: AgentChatStreamEvent, runId: string, seq: number): AgentServerEvent | null {
  const { callId, toolName } = readToolIdentity(rawEvent.payload ?? {});
  // 中文注释：没有稳定工具身份的 runtime chunk 不进入 LangChain tools channel，
  // 否则 useToolCalls 会把每个 chunk 当成一个新 tool，导致 UI 卡顿和误渲染。
  if (!callId && !toolName) return null;
  const toolCallId = callId ?? toolName ?? "tool";
  const displayName = toolName ?? "tool";
  return {
    event_id: `${runId}_tool_${rawEvent.event_id}`,
    method: "tools",
    params: {
      data:
        rawEvent.type === "tool.started"
          ? { event: "tool-started", input: readToolInput(rawEvent.payload), tool_call_id: toolCallId, tool_name: displayName }
          : { event: "tool-finished", output: readToolOutput(rawEvent.payload), tool_call_id: toolCallId, tool_name: displayName },
      namespace: [],
      timestamp: now(),
    },
    seq,
    type: "event",
  } as AgentServerEvent;
}

function interruptEvent(rawEvent: AgentChatStreamEvent, runId: string, seq: number): AgentServerEvent {
  return {
    event_id: `${runId}_interrupt_${rawEvent.event_id}`,
    method: "input.requested",
    params: {
      data: {
        interrupt_id: rawEvent.event_id,
        payload: rawEvent.payload,
      },
      namespace: [],
      timestamp: now(),
    },
    seq,
    type: "event",
  } as AgentServerEvent;
}

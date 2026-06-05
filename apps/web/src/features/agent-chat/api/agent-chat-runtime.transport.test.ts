import type { AgentServerAdapter } from "@langchain/langgraph-sdk";
import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "@/shared/api";

import { AgentChatRuntimeTransport } from "./agent-chat-runtime.transport";
import type { AgentChatStreamEvent } from "./agent-chat.contracts";

type EventStreamHandle = ReturnType<NonNullable<AgentServerAdapter["openEventStream"]>>;
type AgentServerCommand = Parameters<AgentServerAdapter["send"]>[0];
type AgentServerEvent = EventStreamHandle["events"] extends AsyncIterable<infer T> ? T : never;

describe("AgentChatRuntimeTransport", () => {
  it("bridges backend model deltas into one streamed assistant message", async () => {
    const apiClient = createMockApiClient([
      createStreamEvent({ content: "我需要", event_id: "delta-1", kind: "delta", seq: 1, type: "model.delta" }),
      createStreamEvent({
        content: "先判断是否需要检索。",
        event_id: "reasoning-1",
        kind: "reasoning",
        payload: { reasoning: "先判断是否需要检索。" },
        seq: 2,
        type: "model.reasoning",
      }),
      createStreamEvent({
        content: "再判断工具是否可用。",
        event_id: "reasoning-2",
        kind: "reasoning",
        payload: { reasoning: "再判断工具是否可用。" },
        seq: 3,
        type: "model.reasoning",
      }),
      createStreamEvent({
        content: "Tool tavily_search started.",
        event_id: "tool-start-1",
        kind: "tool",
        payload: { invocation_id: "tool_inv_1", name: "tavily_search", tool_id: "tool.tavily_search" },
        role: "tool",
        seq: 4,
        type: "tool.started",
      }),
      createStreamEvent({
        content: "Todo updated.",
        event_id: "todo-1",
        kind: "todo",
        payload: { todos: [{ content: "补充市场预期", status: "in_progress" }] },
        seq: 5,
        type: "todo.updated",
      }),
      createStreamEvent({ content: "先分析。", event_id: "delta-2", kind: "delta", seq: 2, type: "model.delta" }),
      createStreamEvent({ content: "我需要先分析。", event_id: "final-1", kind: "final", seq: 3, type: "run.final" }),
    ]);
    const transport = new AgentChatRuntimeTransport({
      apiClient,
      sessionId: "session-1",
      threadId: "thread-1",
    });
    const stream = transport.openEventStream({
      channels: ["messages", "values", "lifecycle"],
      depth: 1,
      namespaces: [[]],
    });

    const eventsPromise = collectUntilCompleted(stream.events);
    await transport.send({
      id: 1,
      method: "run.start",
      params: {
        assistant_id: "agent-chat",
        input: { messages: [{ content: "分析这个事件", type: "human" }] },
      },
      type: "command",
    } as unknown as AgentServerCommand);

    const events = await eventsPromise;
    stream.close();
    await transport.close();

    expect(apiClient.stream).toHaveBeenCalledWith(
      "/agent-chat/sessions/session-1/messages/stream",
      expect.objectContaining({ data: { message: "分析这个事件" } }),
    );
    expect(events.filter((event) => event.method === "messages").map((event) => event.params.data)).toMatchObject([
      { event: "message-start", role: "ai" },
      { event: "content-block-start" },
      { delta: { text: "我需要", type: "text-delta" }, event: "content-block-delta" },
      { delta: { text: "先分析。", type: "text-delta" }, event: "content-block-delta" },
      { content: { text: "我需要先分析。", type: "text" }, event: "content-block-finish" },
      { event: "message-finish" },
    ]);

    const latestValues = events
      .filter((event) => event.method === "values")
      .at(-1)?.params.data as
      | {
          messages?: Array<{ content: string; type: string }>;
          timeline?: Array<{ content: string; id: string; kind: string; role: string; type?: string }>;
        }
      | undefined;

    expect(latestValues?.messages).toEqual([
      { content: "分析这个事件", id: expect.stringMatching(/^human_/u), type: "human" },
      { content: "我需要先分析。", id: expect.stringMatching(/^ai_/u), type: "ai" },
    ]);
    expect(latestValues?.timeline).toEqual([
      expect.objectContaining({ content: "分析这个事件", id: expect.stringMatching(/^human_/u), kind: "message", role: "user" }),
      expect.objectContaining({ content: "我需要先分析。", id: expect.stringMatching(/^ai_/u), kind: "final", role: "assistant" }),
      expect.objectContaining({ content: "先判断是否需要检索。再判断工具是否可用。", id: "reasoning_run-1", kind: "reasoning", type: "model.reasoning" }),
      expect.objectContaining({ content: "Tool tavily_search started.", id: "tool_run-1_tool_inv_1", kind: "tool", type: "tool.started" }),
      expect.objectContaining({ content: "Todo updated.", id: "todo-1", kind: "todo", type: "todo.updated" }),
    ]);
    expect(latestValues?.timeline?.filter((item) => item.kind === "reasoning")).toHaveLength(1);
  });
});

function createMockApiClient(events: AgentChatStreamEvent[]): ApiClient {
  const stream = vi.fn(async () => createSseResponse(events));
  return {
    instance: { defaults: {} },
    del: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    request: vi.fn(),
    requestEnvelope: vi.fn(),
    stream,
  } as unknown as ApiClient;
}

function createSseResponse(events: AgentChatStreamEvent[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const event of events) {
          controller.enqueue(encoder.encode(`event: ${event.type}\nid: ${event.event_id}\ndata: ${JSON.stringify(event)}\n\n`));
        }
        controller.close();
      },
    }),
    { headers: { "content-type": "text/event-stream" } },
  );
}

function createStreamEvent(overrides: Partial<AgentChatStreamEvent>): AgentChatStreamEvent {
  return {
    agent_run_id: "agent-run-1",
    content: "",
    created_at: "2026-06-05T00:00:00Z",
    event_id: "event-1",
    kind: "delta",
    payload: {},
    role: "assistant",
    run_id: "run-1",
    seq: 1,
    session_id: "session-1",
    trace_id: "trace-1",
    type: "model.delta",
    ...overrides,
  };
}

async function collectUntilCompleted(events: AsyncIterable<AgentServerEvent>): Promise<AgentServerEvent[]> {
  const collected: AgentServerEvent[] = [];
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Timed out waiting for Agent Chat stream completion.")), 1_000);
  });
  const run = (async () => {
    for await (const event of events) {
      collected.push(event);
      if (event.method === "lifecycle" && event.params.data.event === "completed") break;
    }
    return collected;
  })();
  return Promise.race([run, timeout]);
}

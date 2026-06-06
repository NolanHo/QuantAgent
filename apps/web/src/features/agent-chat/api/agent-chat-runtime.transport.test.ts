import type { AgentServerAdapter } from "@langchain/langgraph-sdk";
import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "@/shared/api";

import { AgentChatRuntimeTransport } from "./agent-chat-runtime.transport";
import type { AgentChatStreamEvent, AgentRuntimeEventV1 } from "./agent-chat.contracts";

type EventStreamHandle = ReturnType<NonNullable<AgentServerAdapter["openEventStream"]>>;
type AgentServerCommand = Parameters<AgentServerAdapter["send"]>[0];
type AgentServerEvent = EventStreamHandle["events"] extends AsyncIterable<infer T> ? T : never;

describe("AgentChatRuntimeTransport", () => {
  it("uses runtime_event v1 as the timeline truth for main and subagent events", async () => {
    const apiClient = createMockApiClient([
      createV1StreamEvent({
        event_id: "main-delta",
        event_type: "agent.message.delta",
        content: { delta_mode: "append", format: "markdown", text: "我先读取上下文。" },
        render: { content_kind: "message", group_id: "span_main_agent-run-1", lane: "main", target: "cot" },
        seq: 1,
      }),
      createV1StreamEvent({
        event_id: "task-start",
        event_type: "tool.started",
        render: { content_kind: "tool", group_id: "span_main_agent-run-1", lane: "main", target: "cot" },
        seq: 2,
        tool: { call_id: "call_task_1", input: { agent: "evidence_research_analyst" }, name: "task" },
      }),
      createV1StreamEvent({
        actor: { display_name: "Research Agent", id: "research", name: "evidence_research_analyst", type: "subagent" },
        event_id: "research-delta",
        event_type: "agent.message.delta",
        content: { delta_mode: "append", format: "markdown", text: "Research Agent 正在检索。" },
        render: { content_kind: "message", group_id: "span_subagent_call_task_1", lane: "subagent", target: "cot" },
        seq: 3,
        span: { kind: "subagent_run", parent_span_id: "span_main_agent-run-1", span_id: "span_subagent_call_task_1" },
        subagent: { name: "evidence_research_analyst", subagent_id: "research", task_call_id: "call_task_1" },
      }),
      createV1StreamEvent({
        actor: { display_name: "search_web", id: "search_web", name: "search_web", type: "tool" },
        event_id: "research-tool",
        event_type: "tool.failed",
        render: { content_kind: "tool", group_id: "span_subagent_call_task_1", lane: "subagent", target: "cot" },
        seq: 4,
        span: { kind: "tool_call", parent_span_id: "span_subagent_call_task_1", span_id: "span_tool_call_search_1" },
        subagent: { name: "evidence_research_analyst", subagent_id: "research", task_call_id: "call_task_1" },
        tool: { call_id: "call_search_1", error: { message: "未配置 TAVILY_API_KEY", type: "ToolConfigError" }, name: "search_web" },
      }),
      createV1StreamEvent({
        event_id: "final",
        event_type: "agent.message.final",
        content: { delta_mode: "snapshot", format: "markdown", text: "最终结论。" },
        render: { content_kind: "message", group_id: "span_main_agent-run-1", lane: "main", target: "final" },
        seq: 5,
      }),
    ]);
    const transport = new AgentChatRuntimeTransport({
      apiClient,
      sessionId: "session-1",
      threadId: "thread-1",
    });
    const stream = transport.openEventStream({
      channels: ["messages", "values", "tools", "lifecycle"],
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

    const latestValues = events
      .filter((event) => event.method === "values")
      .at(-1)?.params.data as
      | {
          messages?: Array<{ content: string; type: string }>;
          timeline?: Array<{ id: string; runtimeEvent?: AgentRuntimeEventV1; type?: string }>;
        }
      | undefined;

    expect(latestValues?.messages?.filter((message) => message.type === "ai")).toEqual([{ content: "最终结论。", id: expect.stringMatching(/^ai_/u), type: "ai" }]);
    expect(latestValues?.timeline?.map((item) => item.runtimeEvent?.event_type ?? item.type)).toEqual([
      "message.local",
      "agent.message.delta",
      "tool.started",
      "agent.message.delta",
      "tool.failed",
      "agent.message.final",
    ]);
    expect(latestValues?.timeline?.filter((item) => item.id.includes("call_search_1"))).toHaveLength(1);
    expect(events.filter((event) => event.method === "tools").map((event) => event.params.data)).toEqual([
      { event: "tool-started", input: { agent: "evidence_research_analyst" }, tool_call_id: "call_task_1", tool_name: "task" },
      { event: "tool-finished", output: "未配置 TAVILY_API_KEY", tool_call_id: "call_search_1", tool_name: "search_web" },
    ]);
  });

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
        payload: { actor_type: "main", input: { query: "NVDA earnings consensus" }, invocation_id: "tool_inv_1", name: "tavily_search", tool_id: "tool.tavily_search" },
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
      channels: ["messages", "values", "tools", "lifecycle"],
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
      expect.objectContaining({ content: "先判断是否需要检索。", id: "reasoning-1", kind: "reasoning", type: "model.reasoning" }),
      expect.objectContaining({ content: "再判断工具是否可用。", id: "reasoning-2", kind: "reasoning", type: "model.reasoning" }),
      expect.objectContaining({ content: "Tool tavily_search started.", id: "tool_run-1_main_root_tool_inv_1", kind: "tool", type: "tool.started" }),
      expect.objectContaining({ content: "Todo updated.", id: "todo-1", kind: "todo", type: "todo.updated" }),
    ]);
    expect(latestValues?.timeline?.filter((item) => item.kind === "reasoning")).toHaveLength(2);
    expect(events.filter((event) => event.method === "tools").map((event) => event.params.data)).toEqual([
      {
        event: "tool-started",
        input: { query: "NVDA earnings consensus" },
        tool_call_id: "tool_inv_1",
        tool_name: "tavily_search",
      },
    ]);
  });

  it("does not publish unidentifiable tool chunks to the LangChain tool channel", async () => {
    const apiClient = createMockApiClient([
      createStreamEvent({
        content: "DeepAgents runtime event.",
        event_id: "toolish-runtime-chunk",
        kind: "tool",
        payload: { source: "messages", raw: { type: "AIMessageChunk" } },
        role: "tool",
        seq: 1,
        type: "tool.completed",
      }),
      createStreamEvent({ content: "完成。", event_id: "final-1", kind: "final", seq: 2, type: "run.final" }),
    ]);
    const transport = new AgentChatRuntimeTransport({
      apiClient,
      sessionId: "session-1",
      threadId: "thread-1",
    });
    const stream = transport.openEventStream({
      channels: ["messages", "values", "tools", "lifecycle"],
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

    expect(events.filter((event) => event.method === "tools")).toHaveLength(0);
  });

  it("drops malformed partial tool args from tool input", async () => {
    const apiClient = createMockApiClient([
      createStreamEvent({
        content: "Tool get_run_context started.",
        event_id: "tool-start-1",
        kind: "tool",
        payload: { args: "}", name: "get_run_context", tool_call_id: "call_1" },
        role: "tool",
        seq: 1,
        type: "tool.started",
      }),
      createStreamEvent({ content: "完成。", event_id: "final-1", kind: "final", seq: 2, type: "run.final" }),
    ]);
    const transport = new AgentChatRuntimeTransport({
      apiClient,
      sessionId: "session-1",
      threadId: "thread-1",
    });
    const stream = transport.openEventStream({
      channels: ["messages", "values", "tools", "lifecycle"],
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

    expect(events.filter((event) => event.method === "tools").map((event) => event.params.data)).toEqual([
      {
        event: "tool-started",
        input: undefined,
        tool_call_id: "call_1",
        tool_name: "get_run_context",
      },
    ]);
  });

  it("keeps main task tool and subagent tools as separate timeline items", async () => {
    const apiClient = createMockApiClient([
      createStreamEvent({
        content: "Research Agent 返回压缩报告。",
        event_id: "task-completed",
        kind: "tool",
        payload: { actor_type: "main", graph_namespace: ["tools:task_1"], name: "task", output: "Research Agent 返回压缩报告。", tool_call_id: "call_task_1" },
        role: "tool",
        seq: 1,
        type: "tool.completed",
      }),
      createStreamEvent({
        content: "工具 search_web 开始调用。",
        event_id: "search-started",
        kind: "tool",
        payload: {
          actor_type: "subagent",
          graph_namespace: ["evidence_research_analyst:task_1"],
          input: { query: "NVDA earnings consensus" },
          name: "search_web",
          subagent_name: "evidence_research_analyst",
          tool_call_id: "call_search_1",
        },
        role: "tool",
        seq: 2,
        type: "tool.started",
      }),
      createStreamEvent({ content: "完成。", event_id: "final-1", kind: "final", seq: 3, type: "run.final" }),
    ]);
    const transport = new AgentChatRuntimeTransport({
      apiClient,
      sessionId: "session-1",
      threadId: "thread-1",
    });
    const stream = transport.openEventStream({
      channels: ["messages", "values", "tools", "lifecycle"],
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

    const latestValues = events
      .filter((event) => event.method === "values")
      .at(-1)?.params.data as { timeline?: Array<{ id: string; kind: string; payload: Record<string, unknown> }> } | undefined;
    const toolItems = latestValues?.timeline?.filter((item) => item.kind === "tool") ?? [];

    expect(toolItems.map((item) => item.id)).toEqual([
      "tool_run-1_main_tools:task_1_call_task_1",
      "tool_run-1_evidence_research_analyst_evidence_research_analyst:task_1_call_search_1",
    ]);
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

function createV1StreamEvent(overrides: Partial<AgentRuntimeEventV1>): AgentChatStreamEvent {
  const runtimeEvent: AgentRuntimeEventV1 = {
    actor: { display_name: "Semiconductor MainAgent", id: "main", name: "Semiconductor MainAgent", type: "main_agent" },
    agent_run_id: "agent-run-1",
    event_id: "runtime-event-1",
    event_type: "agent.message.delta",
    render: { content_kind: "message", group_id: "span_main_agent-run-1", lane: "main", target: "cot" },
    schema_version: "agent-runtime-event.v1",
    seq: 1,
    session_id: "session-1",
    span: { kind: "main_run", parent_span_id: null, span_id: "span_main_agent-run-1" },
    thread_id: "thread-1",
    workspace_id: "workspace-1",
    ...overrides,
  };
  return createStreamEvent({
    content: runtimeEvent.content?.text ?? "",
    event_id: runtimeEvent.event_id,
    kind: runtimeEvent.render.content_kind,
    payload: { runtime_event: runtimeEvent },
    role: runtimeEvent.actor.type === "tool" ? "tool" : "assistant",
    runtime_event: runtimeEvent,
    seq: runtimeEvent.seq,
    type: runtimeEvent.event_type,
  });
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

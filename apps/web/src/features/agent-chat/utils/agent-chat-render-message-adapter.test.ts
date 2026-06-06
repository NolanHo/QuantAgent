import { describe, expect, it } from "vitest";

import type { AgentRuntimeEventV1 } from "../api/agent-chat.contracts";
import type { AgentChatTimelineItem } from "../types";
import { agentTimelineToRenderMessages } from "./agent-chat-render-message-adapter";

describe("agentTimelineToRenderMessages", () => {
  it("renders v1 protocol events by render lane instead of legacy payload guesses", () => {
    const messages = agentTimelineToRenderMessages([
      item({ content: "分析这个事件", id: "user-1", kind: "message", role: "user", seq: 1 }),
      v1Item({
        event_id: "main-reasoning-1",
        event_type: "agent.reasoning.delta",
        content: { delta_mode: "append", format: "markdown", text: "我需要先识别一手材料。" },
        render: { content_kind: "reasoning", group_id: "span_main_agent-run-1", lane: "main", target: "cot" },
        seq: 2,
      }),
      v1Item({
        event_id: "task-start",
        event_type: "tool.started",
        render: { content_kind: "tool", group_id: "span_main_agent-run-1", lane: "main", target: "cot" },
        seq: 3,
        tool: { call_id: "call_task_1", input: { agent: "evidence_research_analyst", instruction: "检索市场预期" }, name: "task" },
      }),
      v1Item({
        actor: { display_name: "Research Agent", id: "research", name: "evidence_research_analyst", type: "subagent" },
        event_id: "research-reasoning-1",
        event_type: "agent.reasoning.delta",
        content: { delta_mode: "append", format: "markdown", text: "我先检索 consensus 和盘后反应。" },
        render: { content_kind: "reasoning", group_id: "span_subagent_call_task_1", lane: "subagent", target: "cot" },
        seq: 4,
        span: { kind: "subagent_run", parent_span_id: "span_main_agent-run-1", span_id: "span_subagent_call_task_1" },
        subagent: { name: "evidence_research_analyst", subagent_id: "research", task_call_id: "call_task_1" },
      }),
      v1Item({
        actor: { display_name: "Research Agent", id: "research", name: "evidence_research_analyst", type: "subagent" },
        event_id: "research-message-1",
        event_type: "agent.message.delta",
        content: { delta_mode: "append", format: "markdown", text: "已确认 Tavily 缺 key，按可恢复缺口处理。" },
        render: { content_kind: "message", group_id: "span_subagent_call_task_1", lane: "subagent", target: "cot" },
        seq: 5,
        span: { kind: "subagent_run", parent_span_id: "span_main_agent-run-1", span_id: "span_subagent_call_task_1" },
        subagent: { name: "evidence_research_analyst", subagent_id: "research", task_call_id: "call_task_1" },
      }),
      v1Item({
        actor: { display_name: "search_web", id: "search_web", name: "search_web", type: "tool" },
        event_id: "research-tool-failed",
        event_type: "tool.failed",
        render: { content_kind: "tool", group_id: "span_subagent_call_task_1", lane: "subagent", target: "cot" },
        seq: 6,
        span: { kind: "tool_call", parent_span_id: "span_subagent_call_task_1", span_id: "span_tool_call_search_1" },
        subagent: { name: "evidence_research_analyst", subagent_id: "research", task_call_id: "call_task_1" },
        tool: { call_id: "call_search_1", error: { message: "未配置 TAVILY_API_KEY", type: "ToolConfigError" }, input: { query: "NVDA earnings consensus" }, name: "search_web" },
      }),
      v1Item({
        event_id: "runtime-raw-1",
        event_type: "runtime.raw",
        content: { delta_mode: "append", format: "markdown", text: "DeepAgents runtime event." },
        render: { content_kind: "notice", group_id: "span_main_agent-run-1", lane: "runtime", target: "side_panel" },
        seq: 7,
      }),
      v1Item({
        event_id: "final-1",
        event_type: "agent.message.final",
        content: { delta_mode: "snapshot", format: "markdown", text: "最终结论：一手数据强，但缺少外部预期验证。" },
        render: { content_kind: "message", group_id: "span_main_agent-run-1", lane: "main", target: "final" },
        seq: 8,
      }),
    ]);

    const assistant = messages[1];
    const subagent = assistant?.parts.find((part) => part.type === "subagent");
    expect(assistant?.parts).toMatchObject([
      { text: "我需要先识别一手材料。", type: "reasoning" },
      { callId: "call_task_1", name: "task", status: "running", type: "tool" },
      { agentName: "evidence_research_analyst", title: "Research Agent", type: "subagent" },
      { display: "response", text: "最终结论：一手数据强，但缺少外部预期验证。", type: "text" },
    ]);
    expect(subagent?.type === "subagent" ? subagent.steps : []).toMatchObject([
      { text: "我先检索 consensus 和盘后反应。", type: "reasoning" },
      { display: "process", text: "已确认 Tavily 缺 key，按可恢复缺口处理。", type: "text" },
      {
        callId: "call_search_1",
        input: { query: "NVDA earnings consensus" },
        name: "search_web",
        output: "未配置 TAVILY_API_KEY",
        status: "error",
        type: "tool",
      },
    ]);
    expect(JSON.stringify(messages)).not.toContain("DeepAgents runtime event.");
    expect(assistant?.parts.filter((part) => part.type === "tool")).toHaveLength(1);
  });

  it("uses payload.runtime_event when timeline runtimeEvent property is missing", () => {
    const subagentReasoning = v1Item({
      actor: { display_name: "Research Agent", id: "research", name: "evidence_research_analyst", type: "subagent" },
      event_id: "research-reasoning-payload-only",
      event_type: "agent.reasoning.delta",
      content: { delta_mode: "append", format: "markdown", text: "Research Agent 应该在 SubAgent 节点里。" },
      render: { content_kind: "reasoning", group_id: "span_subagent_call_task_1", lane: "subagent", target: "cot" },
      seq: 2,
      span: { kind: "subagent_run", parent_span_id: "span_main_agent-run-1", span_id: "span_subagent_call_task_1" },
      subagent: { name: "evidence_research_analyst", subagent_id: "research", task_call_id: "call_task_1" },
    });
    delete subagentReasoning.runtimeEvent;

    const messages = agentTimelineToRenderMessages([
      item({ content: "分析这个事件", id: "user-1", kind: "message", role: "user", seq: 1 }),
      subagentReasoning,
    ]);

    const assistant = messages[1];
    const subagent = assistant?.parts.find((part) => part.type === "subagent");
    expect(assistant?.parts.filter((part) => part.type === "reasoning")).toHaveLength(0);
    expect(subagent?.type === "subagent" ? subagent.steps : []).toMatchObject([
      { text: "Research Agent 应该在 SubAgent 节点里。", type: "reasoning" },
    ]);
  });

  it("groups contiguous reasoning chunks and starts a new reasoning step after tool events", () => {
    const messages = agentTimelineToRenderMessages([
      item({ content: "分析这个事件", id: "user-1", kind: "message", role: "user", seq: 1 }),
      item({ content: "先", id: "reasoning-1", kind: "reasoning", role: "assistant", seq: 2, type: "model.reasoning" }),
      item({ content: "识别来源。", id: "reasoning-2", kind: "reasoning", role: "assistant", seq: 3, type: "model.reasoning" }),
      item({
        content: "Tool tavily_search started.",
        id: "tool-start",
        kind: "tool",
        payload: { input: { query: "NVDA earnings consensus" }, invocation_id: "tool_inv_1", name: "tavily_search" },
        role: "tool",
        seq: 4,
        type: "tool.started",
      }),
      item({
        content: "共识预期低于官方披露。",
        id: "tool-finish",
        kind: "tool",
        payload: { invocation_id: "tool_inv_1", name: "tavily_search", result: { summary: "共识预期低于官方披露。" } },
        role: "tool",
        seq: 5,
        type: "tool.completed",
      }),
      item({ content: "再补充市场预期。", id: "reasoning-3", kind: "reasoning", role: "assistant", seq: 6, type: "model.reasoning" }),
      item({ content: "结论：高时效一手财报事件。", id: "final-1", kind: "final", role: "assistant", seq: 6 }),
    ]);

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ role: "user", parts: [{ type: "text", text: "分析这个事件" }] });
    expect(messages[1]?.parts).toMatchObject([
      { type: "reasoning", text: "先识别来源。" },
      {
        type: "tool",
        callId: "tool_inv_1",
        input: { query: "NVDA earnings consensus" },
        name: "tavily_search",
        output: '{\n  "summary": "共识预期低于官方披露。"\n}',
        status: "completed",
      },
      { type: "reasoning", text: "再补充市场预期。" },
      { type: "text", text: "结论：高时效一手财报事件。" },
    ]);
    expect(messages[1]?.parts.filter((part) => part.type === "reasoning")).toHaveLength(2);
    expect(messages[1]?.parts.filter((part) => part.type === "tool")).toHaveLength(1);
  });

  it("replaces cumulative reasoning snapshots instead of appending duplicate text", () => {
    const messages = agentTimelineToRenderMessages([
      item({ content: "分析这个事件", id: "user-1", kind: "message", role: "user", seq: 1 }),
      item({ content: "我需要先获取上下文。", id: "reasoning-1", kind: "reasoning", role: "assistant", seq: 2, type: "model.reasoning" }),
      item({
        content: "我需要先获取上下文。然后补充市场预期。",
        id: "reasoning-2",
        kind: "reasoning",
        role: "assistant",
        seq: 3,
        type: "model.reasoning",
      }),
    ]);

    expect(messages[1]?.parts).toMatchObject([{ type: "reasoning", text: "我需要先获取上下文。然后补充市场预期。" }]);
  });

  it("keeps assistant deltas in the process chain before the final response", () => {
    const messages = agentTimelineToRenderMessages([
      item({ content: "分析这个事件", id: "user-1", kind: "message", role: "user", seq: 1 }),
      item({ content: "我需要先获取上下文。", id: "reasoning-1", kind: "reasoning", role: "assistant", seq: 2, type: "model.reasoning" }),
      item({ content: "好的，我已经获得完整的运行上下文。", id: "delta-1", kind: "delta", role: "assistant", seq: 3, type: "model.delta" }),
      item({
        content: "工具 get_run_context 调用完成。",
        id: "tool-1",
        kind: "tool",
        payload: { actor_type: "main", name: "get_run_context", output: { ok: true }, tool_call_id: "call_context_1" },
        role: "tool",
        seq: 4,
        type: "tool.completed",
      }),
      item({ content: "现在创建分析计划并启动检索。", id: "delta-2", kind: "delta", role: "assistant", seq: 5, type: "model.delta" }),
      item({ content: "最终结论：需要补充市场预期后再判断。", id: "final-1", kind: "final", role: "assistant", seq: 6, type: "run.output" }),
    ]);

    expect(messages[1]?.parts).toMatchObject([
      { type: "reasoning", text: "我需要先获取上下文。" },
      { display: "process", text: "好的，我已经获得完整的运行上下文。", type: "text" },
      { callId: "call_context_1", name: "get_run_context", type: "tool" },
      { display: "process", text: "现在创建分析计划并启动检索。", type: "text" },
      { display: "response", text: "最终结论：需要补充市场预期后再判断。", type: "text" },
    ]);
  });

  it("keeps unknown runtime events out of the main rendered assistant flow", () => {
    const messages = agentTimelineToRenderMessages([
      item({ content: "分析这个事件", id: "user-1", kind: "message", role: "user", seq: 1 }),
      item({
        content: "DeepAgents runtime event.",
        id: "runtime-1",
        kind: "system_event",
        payload: { raw: { agent: { messages: [] } }, source: "updates" },
        role: "assistant",
        seq: 2,
        type: "runtime.event",
      }),
      item({ content: "结论：继续分析。", id: "final-1", kind: "final", role: "assistant", seq: 3, type: "run.output" }),
    ]);

    expect(messages).toHaveLength(2);
    expect(messages[1]?.parts).toMatchObject([{ type: "text", text: "结论：继续分析。" }]);
    expect(JSON.stringify(messages)).not.toContain("DeepAgents runtime event.");
    expect(JSON.stringify(messages)).not.toContain("运行事件");
  });

  it("keeps run lifecycle events out of the rendered assistant flow", () => {
    const messages = agentTimelineToRenderMessages([
      item({ content: "分析这个事件", id: "user-1", kind: "message", role: "user", seq: 1 }),
      item({
        content: "AgentRun agent_run_1 started.",
        id: "run-started",
        kind: "system_event",
        role: "assistant",
        seq: 2,
        type: "run.started",
      }),
      item({ content: "结论。", id: "final-1", kind: "final", role: "assistant", seq: 3, type: "run.output" }),
    ]);

    expect(messages).toHaveLength(2);
    expect(JSON.stringify(messages)).not.toContain("AgentRun agent_run_1 started.");
    expect(messages[1]?.parts).toMatchObject([{ type: "text", text: "结论。" }]);
  });

  it("ignores malformed string tool args instead of rendering a fake args input", () => {
    const messages = agentTimelineToRenderMessages([
      item({ content: "分析这个事件", id: "user-1", kind: "message", role: "user", seq: 1 }),
      item({
        content: "Tool tool started.",
        id: "tool-start",
        kind: "tool",
        payload: { args: "}", tool_call_id: "call_1", name: "tool" },
        role: "tool",
        seq: 2,
        type: "tool.started",
      }),
    ]);

    const tool = messages[1]?.parts.find((part) => part.type === "tool");
    expect(tool).toMatchObject({ callId: "call_1", name: "tool", status: "running" });
    expect(tool?.type === "tool" ? tool.input : null).toBeUndefined();
  });

  it("renders write_todos tool input as the task list UI", () => {
    const messages = agentTimelineToRenderMessages([
      item({ content: "分析这个事件", id: "user-1", kind: "message", role: "user", seq: 1 }),
      item({
        content: "Tool write_todos started.",
        id: "todos-start",
        kind: "tool",
        payload: {
          input: {
            todos: [
              { content: "识别第一手材料", status: "in_progress" },
              { content: "补充市场预期", status: "pending" },
            ],
          },
          name: "write_todos",
          tool_call_id: "call_todos_1",
        },
        role: "tool",
        seq: 2,
        type: "tool.started",
      }),
    ]);

    expect(messages[1]?.parts).toMatchObject([
      {
        tasks: [
          { label: "识别第一手材料", status: "in_progress" },
          { label: "补充市场预期", status: "pending" },
        ],
        type: "tasks",
      },
    ]);
    expect(messages[1]?.parts.filter((part) => part.type === "tool")).toHaveLength(0);
  });

  it("updates task list UI from write_todos result text instead of rendering json-like tool output", () => {
    const messages = agentTimelineToRenderMessages([
      item({ content: "分析这个事件", id: "user-1", kind: "message", role: "user", seq: 1 }),
      item({
        content: "Tool write_todos started.",
        id: "todos-start",
        kind: "tool",
        payload: {
          input: {
            todos: [
              { content: "识别第一手材料", status: "in_progress" },
              { content: "补充市场预期", status: "pending" },
            ],
          },
          name: "write_todos",
          tool_call_id: "call_todos_1",
        },
        role: "tool",
        seq: 2,
        type: "tool.started",
      }),
      item({
        content: "Updated todo list to [{'content': '识别第一手材料', 'status': 'completed'}, {'content': '补充市场预期', 'status': 'in_progress'}]",
        id: "todos-completed",
        kind: "tool",
        payload: {
          name: "write_todos",
          output: "Updated todo list to [{'content': '识别第一手材料', 'status': 'completed'}, {'content': '补充市场预期', 'status': 'in_progress'}]",
          tool_call_id: "call_todos_1",
        },
        role: "tool",
        seq: 3,
        type: "tool.completed",
      }),
    ]);

    expect(messages[1]?.parts).toMatchObject([
      {
        tasks: [
          { label: "识别第一手材料", status: "completed" },
          { label: "补充市场预期", status: "in_progress" },
        ],
        type: "tasks",
      },
    ]);
    expect(JSON.stringify(messages)).not.toContain("Updated todo list to");
    expect(messages[1]?.parts.filter((part) => part.type === "tool")).toHaveLength(0);
  });

  it("groups subagent scoped reasoning and tools into a Research Agent node", () => {
    const messages = agentTimelineToRenderMessages([
      item({ content: "分析这个事件", id: "user-1", kind: "message", role: "user", seq: 1 }),
      item({ content: "我先委派 Research Agent。", id: "reasoning-main", kind: "reasoning", role: "assistant", seq: 2, type: "model.reasoning" }),
      item({
        content: "Research Agent 开始检索。",
        id: "research-reasoning",
        kind: "reasoning",
        payload: { actor_type: "subagent", graph_namespace: ["evidence_research_analyst:task_1"], subagent_name: "evidence_research_analyst" },
        role: "assistant",
        seq: 3,
        type: "model.reasoning",
      }),
      item({
        content: "工具 search_web 开始调用。",
        id: "research-tool-start",
        kind: "tool",
        payload: {
          graph_namespace: ["evidence_research_analyst:task_1"],
          actor_type: "subagent",
          input: { query: "NVDA earnings consensus" },
          name: "search_web",
          subagent_name: "evidence_research_analyst",
          tool_call_id: "call_search_1",
        },
        role: "tool",
        seq: 4,
        type: "tool.started",
      }),
      item({
        content: "找到市场预期线索。",
        id: "research-tool-finish",
        kind: "tool",
        payload: {
          graph_namespace: ["evidence_research_analyst:task_1"],
          actor_type: "subagent",
          output: { summary: "找到市场预期线索。" },
          name: "search_web",
          subagent_name: "evidence_research_analyst",
          tool_call_id: "call_search_1",
        },
        role: "tool",
        seq: 5,
        type: "tool.completed",
      }),
      item({ content: "结论：继续分析。", id: "final-1", kind: "final", role: "assistant", seq: 6, type: "run.output" }),
    ]);

    const assistant = messages[1];
    const subagent = assistant?.parts.find((part) => part.type === "subagent");
    expect(subagent).toMatchObject({
      agentName: "evidence_research_analyst",
      status: "completed",
      title: "Research Agent",
    });
    expect(subagent?.type === "subagent" ? subagent.steps : []).toMatchObject([
      { text: "Research Agent 开始检索。", type: "reasoning" },
      {
        callId: "call_search_1",
        input: { query: "NVDA earnings consensus" },
        name: "search_web",
        output: '{\n  "summary": "找到市场预期线索。"\n}',
        status: "completed",
        type: "tool",
      },
    ]);
    expect(assistant?.parts.filter((part) => part.type === "tool")).toHaveLength(0);
  });

  it("groups tool events with subagent_id fallback into a subagent node", () => {
    const messages = agentTimelineToRenderMessages([
      item({ content: "分析这个事件", id: "user-1", kind: "message", role: "user", seq: 1 }),
      item({
        content: "工具 search_web 开始调用。",
        id: "research-tool-start",
        kind: "tool",
        payload: {
          input: { query: "NVDA earnings consensus" },
          name: "search_web",
          actor_type: "subagent",
          subagent_id: "evidence_research_analyst",
          tool_call_id: "call_search_1",
        },
        role: "tool",
        seq: 2,
        type: "tool.started",
      }),
    ]);

    const assistant = messages[1];
    const subagent = assistant?.parts.find((part) => part.type === "subagent");
    expect(subagent).toMatchObject({
      agentName: "evidence_research_analyst",
      title: "Research Agent",
    });
    expect(assistant?.parts.filter((part) => part.type === "tool")).toHaveLength(0);
  });

  it("groups subagent reasoning and assistant deltas into the same subagent node", () => {
    const messages = agentTimelineToRenderMessages([
      item({ content: "分析这个事件", id: "user-1", kind: "message", role: "user", seq: 1 }),
      item({
        content: "Research Agent 先读取上下文。",
        id: "research-reasoning",
        kind: "reasoning",
        payload: { actor_type: "subagent", graph_namespace: ["tools:task_1"], subagent_name: "evidence_research_analyst" },
        role: "assistant",
        seq: 2,
        type: "model.reasoning",
      }),
      item({
        content: "已获取上下文，现在检索市场预期。",
        id: "research-delta",
        kind: "delta",
        payload: { actor_type: "subagent", graph_namespace: ["tools:task_1"], subagent_name: "evidence_research_analyst" },
        role: "assistant",
        seq: 3,
        type: "model.delta",
      }),
      item({ content: "最终结论。", id: "final-1", kind: "final", role: "assistant", seq: 4, type: "run.output" }),
    ]);

    const assistant = messages[1];
    const subagent = assistant?.parts.find((part) => part.type === "subagent");
    expect(subagent?.type === "subagent" ? subagent.steps : []).toMatchObject([
      { text: "Research Agent 先读取上下文。", type: "reasoning" },
      { display: "process", text: "已获取上下文，现在检索市场预期。", type: "text" },
    ]);
    expect(assistant?.parts.filter((part) => part.type === "reasoning")).toHaveLength(0);
    expect(assistant?.parts.filter((part) => part.type === "text" && part.display === "process")).toHaveLength(0);
  });

  it("does not treat tools namespace as a subagent without explicit subagent actor", () => {
    const messages = agentTimelineToRenderMessages([
      item({ content: "分析这个事件", id: "user-1", kind: "message", role: "user", seq: 1 }),
      item({
        content: "现在委派 Research Agent 去检索。",
        id: "task-tool-result",
        kind: "tool",
        payload: {
          actor_type: "main",
          graph_namespace: ["tools:task_1"],
          name: "task",
          output: "Research Agent 返回压缩报告。",
          tool_call_id: "call_task_1",
        },
        role: "tool",
        seq: 2,
        type: "tool.completed",
      }),
    ]);

    const assistant = messages[1];
    expect(assistant?.parts.filter((part) => part.type === "subagent")).toHaveLength(0);
    expect(assistant?.parts).toMatchObject([
      {
        callId: "call_task_1",
        name: "task",
        status: "completed",
        type: "tool",
      },
    ]);
  });
});

function item(overrides: Partial<AgentChatTimelineItem>): AgentChatTimelineItem {
  return {
    agentRunId: "agent-run-1",
    content: "",
    createdAt: "2026-06-05T00:00:00Z",
    id: "item-1",
    kind: "message",
    payload: {},
    role: "assistant",
    runId: "run-1",
    seq: 1,
    traceId: "trace-1",
    type: "message",
    ...overrides,
  };
}

function v1Item(overrides: Partial<AgentRuntimeEventV1>): AgentChatTimelineItem {
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
  return item({
    content: runtimeEvent.content?.text ?? "",
    id: runtimeEvent.event_id,
    kind: runtimeEvent.render.content_kind,
    payload: { runtime_event: runtimeEvent },
    role: runtimeEvent.actor.type === "tool" ? "tool" : "assistant",
    runtimeEvent,
    seq: runtimeEvent.seq,
    type: runtimeEvent.event_type,
  });
}

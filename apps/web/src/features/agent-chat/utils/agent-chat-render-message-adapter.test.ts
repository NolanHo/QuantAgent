import { describe, expect, it } from "vitest";

import type { AgentChatTimelineItem } from "../types";
import { agentTimelineToRenderMessages } from "./agent-chat-render-message-adapter";

describe("agentTimelineToRenderMessages", () => {
  it("consolidates reasoning chunks and tool lifecycle events into stable render parts", () => {
    const messages = agentTimelineToRenderMessages([
      item({ content: "分析这个事件", id: "user-1", kind: "message", role: "user", seq: 1 }),
      item({ content: "先识别来源。", id: "reasoning-1", kind: "reasoning", role: "assistant", seq: 2, type: "model.reasoning" }),
      item({ content: "再补充市场预期。", id: "reasoning-2", kind: "reasoning", role: "assistant", seq: 3, type: "model.reasoning" }),
      item({
        content: "Tool tavily_search started.",
        id: "tool-start",
        kind: "tool",
        payload: { invocation_id: "tool_inv_1", name: "tavily_search", query: "NVDA earnings consensus" },
        role: "tool",
        seq: 4,
        type: "tool.started",
      }),
      item({
        content: "共识预期低于官方披露。",
        id: "tool-finish",
        kind: "tool",
        payload: { invocation_id: "tool_inv_1", name: "tavily_search" },
        role: "tool",
        seq: 5,
        type: "tool.completed",
      }),
      item({ content: "结论：高时效一手财报事件。", id: "final-1", kind: "final", role: "assistant", seq: 6 }),
    ]);

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ role: "user", parts: [{ type: "text", text: "分析这个事件" }] });
    expect(messages[1]?.parts).toMatchObject([
      { type: "reasoning", text: "先识别来源。\n\n再补充市场预期。" },
      { type: "tool", callId: "tool_inv_1", name: "tavily_search", output: "共识预期低于官方披露。", status: "completed" },
      { type: "text", text: "结论：高时效一手财报事件。" },
    ]);
    expect(messages[1]?.parts.filter((part) => part.type === "reasoning")).toHaveLength(1);
    expect(messages[1]?.parts.filter((part) => part.type === "tool")).toHaveLength(1);
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

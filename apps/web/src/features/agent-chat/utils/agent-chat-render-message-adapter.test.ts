import { describe, expect, it } from "vitest";

import type { AgentChatTimelineItem } from "../types";
import { agentTimelineToRenderMessages } from "./agent-chat-render-message-adapter";

describe("agentTimelineToRenderMessages", () => {
  it("keeps reasoning steps separate and merges tool lifecycle events into one render part", () => {
    const messages = agentTimelineToRenderMessages([
      item({ content: "分析这个事件", id: "user-1", kind: "message", role: "user", seq: 1 }),
      item({ content: "先识别来源。", id: "reasoning-1", kind: "reasoning", role: "assistant", seq: 2, type: "model.reasoning" }),
      item({ content: "再补充市场预期。", id: "reasoning-2", kind: "reasoning", role: "assistant", seq: 3, type: "model.reasoning" }),
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
      item({ content: "结论：高时效一手财报事件。", id: "final-1", kind: "final", role: "assistant", seq: 6 }),
    ]);

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ role: "user", parts: [{ type: "text", text: "分析这个事件" }] });
    expect(messages[1]?.parts).toMatchObject([
      { type: "reasoning", text: "先识别来源。" },
      { type: "reasoning", text: "再补充市场预期。" },
      {
        type: "tool",
        callId: "tool_inv_1",
        input: { query: "NVDA earnings consensus" },
        name: "tavily_search",
        output: '{\n  "summary": "共识预期低于官方披露。"\n}',
        status: "completed",
      },
      { type: "text", text: "结论：高时效一手财报事件。" },
    ]);
    expect(messages[1]?.parts.filter((part) => part.type === "reasoning")).toHaveLength(2);
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

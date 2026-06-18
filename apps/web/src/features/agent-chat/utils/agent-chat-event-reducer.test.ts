import { describe, expect, it } from "vitest";

import { applyAgentChatStreamEvent, createInitialAgentChatState } from "./agent-chat-event-reducer";

describe("agent chat event reducer", () => {
  it("appends assistant deltas and preserves raw debug content", () => {
    const state = applyAgentChatStreamEvent(createInitialAgentChatState(), {
      agent_run_id: "agent-run-1",
      content: "hello system prompt sk-test",
      created_at: "2026-06-05T00:00:00Z",
      event_id: "msg-1",
      kind: "delta",
      payload: {},
      role: "assistant",
      run_id: "run-1",
      seq: 1,
      session_id: "session-1",
      trace_id: "trace-1",
      type: "model.delta",
    });

    expect(state.sessionId).toBe("session-1");
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]?.content).toBe("hello system prompt sk-test");
    expect(JSON.stringify(state)).toContain("system prompt");
    expect(JSON.stringify(state)).toContain("sk-test");
  });
});

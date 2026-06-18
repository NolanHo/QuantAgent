import { describe, expect, it } from "vitest";

import { normalizeAgentChatSearch, semiconductorMainAgentId } from "./agent-chat-debug-presets";

describe("agent chat debug presets", () => {
  it("normalizes default industry agent and routed event", () => {
    expect(normalizeAgentChatSearch({})).toEqual({
      agent: semiconductorMainAgentId,
      preset: "nvda-earnings",
      routedEvent: "nvda-earnings",
      sessionId: null,
    });
  });

  it("keeps legacy preset query compatible with routedEvent", () => {
    expect(normalizeAgentChatSearch({ preset: "nvda-media-followup" })).toEqual({
      agent: semiconductorMainAgentId,
      preset: "nvda-media-followup",
      routedEvent: "nvda-media-followup",
      sessionId: null,
    });
  });

  it("keeps existing Agent Chat session id for routed event processing records", () => {
    expect(normalizeAgentChatSearch({ sessionId: " chat_sess_1 " })).toEqual({
      agent: semiconductorMainAgentId,
      preset: "nvda-earnings",
      routedEvent: "nvda-earnings",
      sessionId: "chat_sess_1",
    });
  });
});

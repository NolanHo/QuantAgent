import { describe, expect, it } from "vitest";

import { normalizeAgentChatSearch, semiconductorMainAgentId } from "./agent-chat-debug-presets";

describe("agent chat debug presets", () => {
  it("normalizes default industry agent and routed event", () => {
    expect(normalizeAgentChatSearch({})).toEqual({
      agent: semiconductorMainAgentId,
      preset: "nvda-earnings",
      routedEvent: "nvda-earnings",
    });
  });

  it("keeps legacy preset query compatible with routedEvent", () => {
    expect(normalizeAgentChatSearch({ preset: "nvda-media-followup" })).toEqual({
      agent: semiconductorMainAgentId,
      preset: "nvda-media-followup",
      routedEvent: "nvda-media-followup",
    });
  });
});

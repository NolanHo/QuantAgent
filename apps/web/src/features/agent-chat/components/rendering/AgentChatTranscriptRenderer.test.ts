import { describe, expect, it } from "vitest";

import type { AgentRenderPart } from "../../types";
import { groupAssistantParts } from "./AgentChatTranscriptRenderer";

describe("groupAssistantParts", () => {
  it("keeps subagent blocks between main COT blocks instead of collecting them at the end", () => {
    const parts: AgentRenderPart[] = [
      { status: "completed", text: "Main before task.", type: "reasoning" },
      { callId: "call_task_1", name: "task", status: "completed", type: "tool" },
      {
        agentName: "evidence_research_analyst",
        groupId: "span_subagent_call_task_1",
        status: "completed",
        steps: [{ status: "completed", text: "SubAgent reasoning.", type: "reasoning" }],
        title: "Research Agent",
        type: "subagent",
      },
      { status: "completed", text: "Main after subagent.", type: "reasoning" },
      { display: "response", text: "Final answer.", type: "text" },
    ];

    const blocks = groupAssistantParts(parts);

    expect(blocks.map((block) => block.type)).toEqual(["cot", "part", "cot", "part"]);
    expect(blocks[0]).toMatchObject({ type: "cot", parts: [{ type: "reasoning" }, { type: "tool" }] });
    expect(blocks[1]).toMatchObject({ type: "part", part: { groupId: "span_subagent_call_task_1", type: "subagent" } });
    expect(blocks[2]).toMatchObject({ type: "cot", parts: [{ text: "Main after subagent.", type: "reasoning" }] });
    expect(blocks[3]).toMatchObject({ type: "part", part: { display: "response", text: "Final answer.", type: "text" } });
  });
});

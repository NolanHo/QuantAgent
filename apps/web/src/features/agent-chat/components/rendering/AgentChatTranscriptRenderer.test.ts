import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { AgentArtifactPart, AgentRenderPart } from "../../types";
import { groupAssistantParts } from "./AgentChatTranscriptRenderer";
import { AgentReportArtifactCard } from "./AgentReportArtifactCard";

describe("groupAssistantParts", () => {
  it("keeps subagent nodes inside the main COT instead of splitting the chain", () => {
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

    expect(blocks.map((block) => block.type)).toEqual(["cot", "part"]);
    expect(blocks[0]).toMatchObject({
      type: "cot",
      parts: [
        { type: "reasoning" },
        { type: "tool" },
        { groupId: "span_subagent_call_task_1", type: "subagent" },
        { text: "Main after subagent.", type: "reasoning" },
      ],
    });
    expect(blocks[1]).toMatchObject({ type: "part", part: { display: "response", text: "Final answer.", type: "text" } });
  });

  it("renders report artifacts as expandable cards with markdown content", () => {
    const report = [
      "# NVIDIA FY2027 Q1 财报研究报告",
      "",
      "| 指标 | 实际 |",
      "| --- | --- |",
      "| Revenue | $81.6B |",
      "",
      "- 数据中心业务继续高增长。",
    ].join("\n");
    const part: AgentArtifactPart = {
      agentName: "Research Agent",
      artifactType: "report",
      contentMarkdown: report,
      groupId: "span_subagent_call_task_1",
      rows: [{ label: "来源", value: "Research Agent" }],
      sourceSeq: 5,
      summary: "NVIDIA FY2027 Q1 财报研究报告",
      title: "Research Agent 报告",
      type: "artifact",
    };

    const html = renderToStaticMarkup(createElement(AgentReportArtifactCard, { part }));

    expect(html).toContain("Research Agent 报告");
    expect(html).toContain("NVIDIA FY2027 Q1 财报研究报告");
    expect(html).toContain("Revenue");
    expect(html).toContain("$81.6B");
  });
});

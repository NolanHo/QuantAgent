import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { AgentArtifactPart, AgentRenderMessage, AgentRenderPart } from "../../types";
import { groupAssistantParts } from "./AgentChatTranscriptRenderer";
import { AgentChatTranscriptRenderer } from "./AgentChatTranscriptRenderer";
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

  it("renders a compact run summary before the long COT", () => {
    const message: AgentRenderMessage = {
      createdAt: "2026-05-20T20:25:00Z",
      id: "assistant-1",
      parts: [
        {
          stages: [
            { id: "account", label: "账户上下文", status: "completed", summary: "账户上下文已读取。" },
            { id: "evaluate", label: "Thesis 评估", status: "completed", summary: "建议进入行动计划。" },
            { id: "plan", label: "ActionPlan", status: "completed", summary: "已生成 NVDA open_long 行动计划。" },
            { id: "submit", label: "提交结果", status: "completed", summary: "dry_run_execution_requested" },
          ],
          title: "行动流程",
          type: "action_flow",
        },
        {
          artifactType: "submission",
          rows: [{ label: "执行", value: "dry_run_execution_requested" }],
          summary: "ActionPlan 已进入 execute_then_notify。",
          title: "行动提交结果",
          type: "artifact",
        },
        { status: "completed", text: "很长的推理过程。", type: "reasoning" },
      ],
      role: "assistant",
      title: "Semiconductor MainAgent",
    };

    const html = renderToStaticMarkup(createElement(AgentChatTranscriptRenderer, { messages: [message], showDownload: false }));

    expect(html).toContain("本次运行重点");
    expect(html).toContain("行动流程 4/4");
    expect(html).toContain("提交结果");
    expect(html).toContain("ActionPlan 已进入 execute_then_notify");
  });
});

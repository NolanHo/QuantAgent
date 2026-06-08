import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { AgentRenderPart } from "../../../types";
import { AgentChainOfThought } from "./AgentChainOfThought";

describe("AgentChainOfThought", () => {
  it("collapses long completed chains by default", () => {
    const parts: AgentRenderPart[] = Array.from({ length: 9 }, (_, index) => ({
      status: "completed",
      text: `completed step ${index}`,
      type: "reasoning",
    }));

    const html = renderToStaticMarkup(createElement(AgentChainOfThought, { parts }));

    expect(html).toContain("已折叠");
    expect(html).toContain('data-state="closed"');
  });

  it("keeps running chains open", () => {
    const parts: AgentRenderPart[] = [
      { status: "completed", text: "completed step", type: "reasoning" },
      { status: "streaming", text: "running step", type: "reasoning" },
    ];

    const html = renderToStaticMarkup(createElement(AgentChainOfThought, { parts }));

    expect(html).not.toContain("已折叠");
    expect(html).toContain('data-state="open"');
  });
});

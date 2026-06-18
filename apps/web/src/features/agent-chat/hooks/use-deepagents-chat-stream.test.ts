import { describe, expect, it, vi } from "vitest";

import type { AgentServerAdapter } from "@langchain/langgraph-sdk";

import type { ApiClient } from "@/shared/api";

import { createDeepAgentsStreamOptions } from "./use-deepagents-chat-stream";

describe("createDeepAgentsStreamOptions", () => {
  it("does not pass backend thread id into LangChain React hydration", () => {
    const options = createDeepAgentsStreamOptions({
      apiClient: createMockApiClient(),
      localThreadId: "agent_chat_ui_thread_session-1",
      sessionId: "session-1",
    });

    expect("threadId" in options).toBe(false);
    const transport = options.transport as AgentServerAdapter;
    expect(transport.threadId).toBe("agent_chat_ui_thread_session-1");
  });
});

function createMockApiClient(): ApiClient {
  return {
    instance: { defaults: {} },
    del: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    request: vi.fn(),
    requestEnvelope: vi.fn(),
    stream: vi.fn(),
  } as unknown as ApiClient;
}

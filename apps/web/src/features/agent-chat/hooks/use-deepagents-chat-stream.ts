import { useMemo } from "react";

import { useMessages, useStream, useToolCalls, useValues, type UseStreamOptions } from "@langchain/react";

import type { ApiClient } from "@/shared/api";

import { AgentChatRuntimeTransport } from "../api/agent-chat-runtime.transport";
import type { AgentChatTimelineItem } from "../types";

export interface DeepAgentChatState extends Record<string, unknown> {
  artifacts?: unknown[];
  interrupts?: unknown[];
  messages: Array<{
    content: string;
    id?: string;
    type: "ai" | "human" | "system" | "tool" | string;
  }>;
  runtime_events?: unknown[];
  session_id?: string;
  subagents?: unknown[];
  timeline?: AgentChatTimelineItem[];
  trace_id?: string | null;
  tools?: unknown[];
  todos?: Array<Record<string, unknown>>;
}

export function useDeepAgentsChatStream({
  apiClient,
  configKey,
  sessionId,
}: {
  apiClient: ApiClient;
  configKey?: string;
  sessionId: string | null;
}) {
  const localThreadId = useMemo(
    () => (sessionId ? `agent_chat_ui_thread_${sessionId}_${configKey ?? "default"}` : "agent-chat-uninitialized"),
    [configKey, sessionId],
  );

  const streamOptions = useMemo(
    () => createDeepAgentsStreamOptions({ apiClient, localThreadId, sessionId }),
    [apiClient, localThreadId, sessionId],
  );

  const stream = useStream<DeepAgentChatState>(streamOptions);

  return {
    stream,
    messages: useMessages(stream),
    toolCalls: useToolCalls(stream),
    values: useValues(stream),
  };
}

export function createDeepAgentsStreamOptions({
  apiClient,
  localThreadId,
  sessionId,
}: {
  apiClient: ApiClient;
  localThreadId: string;
  sessionId: string | null;
}): UseStreamOptions<DeepAgentChatState> {
  return {
    initialValues: { messages: [], timeline: [] },
    messagesKey: "messages",
    // 中文注释：不能把后端 DeepAgents thread_id 传给 @langchain/react 的 threadId；
    // 当前 SDK hydrate 会固定 fallback 到默认 LangGraph Client，并请求 localhost:8123/threads/:id/state。
    // 正式 session/thread 由 QuantAgent API 负责，React SDK 只通过 custom transport 接收本地流状态。
    transport: sessionId
      ? new AgentChatRuntimeTransport({
          apiClient,
          sessionId,
          threadId: localThreadId,
        })
      : new AgentChatNoopTransport(localThreadId),
  };
}

class AgentChatNoopTransport extends AgentChatRuntimeTransport {
  constructor(threadId: string) {
    super({
      apiClient: {
        instance: { defaults: {} },
        del: async () => {
          throw new Error("Agent Chat session is not initialized.");
        },
        get: async () => {
          throw new Error("Agent Chat session is not initialized.");
        },
        patch: async () => {
          throw new Error("Agent Chat session is not initialized.");
        },
        post: async () => {
          throw new Error("Agent Chat session is not initialized.");
        },
        put: async () => {
          throw new Error("Agent Chat session is not initialized.");
        },
        request: async () => {
          throw new Error("Agent Chat session is not initialized.");
        },
        requestEnvelope: async () => {
          throw new Error("Agent Chat session is not initialized.");
        },
        stream: async () => {
          throw new Error("Agent Chat session is not initialized.");
        },
      } as unknown as ApiClient,
      sessionId: "agent-chat-uninitialized",
      threadId,
    });
  }
}

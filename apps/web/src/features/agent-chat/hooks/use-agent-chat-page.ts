import { useEffect, useState } from "react";

import { useAppRuntime, useApis } from "@/app/runtime";

import type { AgentChatSearch, AgentChatTimelineItem } from "../types";
import { getAgentChatPresetMessage, getAgentChatPresetTitle } from "../utils";
import { useDeepAgentsChatStream } from "./use-deepagents-chat-stream";

export function useAgentChatPage(search: AgentChatSearch = {}) {
  const runtime = useAppRuntime();
  const { agentChat } = useApis();
  const [draftMessage, setDraftMessage] = useState(() => getAgentChatPresetMessage(search.preset));
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const deepAgent = useDeepAgentsChatStream({ apiClient: runtime.apiClient, sessionId });
  const { stream } = deepAgent;

  useEffect(() => {
    let cancelled = false;
    if (sessionId) return;

    void agentChat
      .createSession({ title: getAgentChatPresetTitle(search.preset) })
      .then((session) => {
        if (cancelled) return;
        setSessionId(session.session_id);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setSessionError(error instanceof Error ? error.message : "Agent Chat session create failed.");
      });

    return () => {
      cancelled = true;
    };
  }, [agentChat, search.preset, sessionId]);

  async function sendMessage() {
    const message = draftMessage.trim();
    if (!message || stream.isLoading || !sessionId) return;
    await stream.submit(
      { messages: [{ type: "human", content: message }] },
      {
        config: { configurable: { session_id: sessionId } },
      },
    );
    setDraftMessage("");
  }

  return {
    abortRun: () => void stream.stop(),
    canSend: Boolean(draftMessage.trim()) && !stream.isLoading && Boolean(sessionId),
    draftMessage,
    debugPreset: search.preset ?? null,
    runtime: {
      artifacts: Array.isArray(deepAgent.values.artifacts) ? deepAgent.values.artifacts : [],
      interrupts: stream.interrupts.length
        ? stream.interrupts
        : Array.isArray(deepAgent.values.interrupts)
          ? deepAgent.values.interrupts
          : [],
      runtimeEvents: Array.isArray(deepAgent.values.runtime_events) ? deepAgent.values.runtime_events : [],
      subagents: Array.from(stream.subagents.values()).length
        ? Array.from(stream.subagents.values())
        : Array.isArray(deepAgent.values.subagents)
          ? deepAgent.values.subagents
          : [],
      todos: Array.isArray(deepAgent.values.todos) ? deepAgent.values.todos : [],
      toolCalls: deepAgent.toolCalls.length
        ? deepAgent.toolCalls
        : Array.isArray(deepAgent.values.tools)
          ? deepAgent.values.tools
          : [],
    },
    sendMessage,
    setDraftMessage,
    stream,
    state: {
      errorSummary:
        sessionError ??
        (stream.error instanceof Error ? stream.error.message : stream.error ? "Agent Chat stream failed." : null),
      messages: Array.isArray(deepAgent.values.timeline)
        ? (deepAgent.values.timeline as AgentChatTimelineItem[])
        : deepAgent.messages.map((message, index) => timelineItemFromLangChainMessage(message, index)),
      sessionId,
      status: stream.isLoading ? "streaming" : stream.error ? "failed" : stream.messages.length > 0 ? "completed" : "idle",
      traceId: typeof deepAgent.values.trace_id === "string" ? deepAgent.values.trace_id : null,
    },
  };
}

function timelineItemFromLangChainMessage(message: { content?: unknown; id?: string; type?: string }, index: number): AgentChatTimelineItem {
  const type = message.type ?? "ai";
  return {
    content: messageContentToText(message.content),
    createdAt: new Date(0).toISOString(),
    id: message.id ?? `${type}_${index}`,
    kind: "message",
    payload: {},
    role: type === "human" ? "user" : type === "tool" ? "tool" : "assistant",
    runId: null,
    seq: index + 1,
    traceId: null,
    type,
  };
}

function messageContentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "text" in item && typeof item.text === "string") return item.text;
        return "";
      })
      .join("");
  }
  return content === null || content === undefined ? "" : String(content);
}

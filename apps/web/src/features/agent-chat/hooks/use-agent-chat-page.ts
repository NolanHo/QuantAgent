import { useEffect, useState } from "react";

import { useAppRuntime, useApis } from "@/app/runtime";

import type { AgentChatSearch, AgentChatTimelineItem } from "../types";
import {
  getAgentChatIndustryAgentOption,
  getAgentChatPresetMessage,
  getAgentChatPresetTitle,
  getAgentChatRoutedEventOption,
  semiconductorIndustryId,
  semiconductorMainAgentId,
} from "../utils";
import { useDeepAgentsChatStream } from "./use-deepagents-chat-stream";

export function useAgentChatPage(search: AgentChatSearch = {}) {
  const runtime = useAppRuntime();
  const { agentChat } = useApis();
  const selectedAgentId = search.agent ?? semiconductorMainAgentId;
  const selectedRoutedEvent = search.routedEvent ?? search.preset ?? "nvda-earnings";
  const selectedAgent = getAgentChatIndustryAgentOption(selectedAgentId);
  const selectedRoutedEventOption = getAgentChatRoutedEventOption(selectedRoutedEvent);
  const [draftMessage, setDraftMessage] = useState(() => getAgentChatPresetMessage(selectedRoutedEvent));
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const deepAgent = useDeepAgentsChatStream({
    apiClient: runtime.apiClient,
    configKey: `${selectedAgentId}:${selectedRoutedEvent}`,
    sessionId,
  });
  const { stream } = deepAgent;

  useEffect(() => {
    setSessionId(null);
    setSessionError(null);
    setDraftMessage(getAgentChatPresetMessage(selectedRoutedEvent));
  }, [selectedAgentId, selectedRoutedEvent]);

  useEffect(() => {
    let cancelled = false;
    if (sessionId) return;

    void agentChat
      .createSession({
        agent_id: selectedAgent.agentId,
        industry_id: selectedAgent.industryId || semiconductorIndustryId,
        routed_event_preset: selectedRoutedEvent,
        title: getAgentChatPresetTitle(selectedRoutedEvent),
      })
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
  }, [agentChat, selectedAgent.agentId, selectedAgent.industryId, selectedRoutedEvent, sessionId]);

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
    selectedAgent,
    selectedRoutedEvent: selectedRoutedEventOption,
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
      // 中文注释：真实 transcript 只能来自 AgentRuntimeEventV1 timeline。
      // @langchain/react 的 messages 是传输层最终文本缓存，不能作为过程流兜底，否则 SubAgent delta 会被聚合成 Main assistant message。
      messages: Array.isArray(deepAgent.values.timeline) ? (deepAgent.values.timeline as AgentChatTimelineItem[]) : [],
      sessionId,
      status: stream.isLoading ? "streaming" : stream.error ? "failed" : stream.messages.length > 0 ? "completed" : "idle",
      traceId: typeof deepAgent.values.trace_id === "string" ? deepAgent.values.trace_id : null,
    },
  };
}

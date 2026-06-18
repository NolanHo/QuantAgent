import { useEffect, useState } from "react";

import { useAppRuntime, useApis } from "@/app/runtime";

import type { AgentChatSearch, AgentChatTimelineItem } from "../types";
import {
  getAgentChatIndustryAgentOption,
  getAgentChatPresetMessage,
  getAgentChatPresetTitle,
  getAgentChatRoutedEventOption,
  stateFromSession,
  semiconductorIndustryId,
  semiconductorMainAgentId,
} from "../utils";
import { useAgentChatSession } from "../queries";
import { useDeepAgentsChatStream } from "./use-deepagents-chat-stream";

export function useAgentChatPage(search: AgentChatSearch = {}) {
  const runtime = useAppRuntime();
  const { agentChat } = useApis();
  const selectedAgentId = search.agent ?? semiconductorMainAgentId;
  const selectedRoutedEvent = search.routedEvent ?? search.preset ?? "nvda-earnings";
  const selectedAgent = getAgentChatIndustryAgentOption(selectedAgentId);
  const selectedRoutedEventOption = getAgentChatRoutedEventOption(selectedRoutedEvent);
  const requestedSessionId = typeof search.sessionId === "string" && search.sessionId ? search.sessionId : null;
  const [draftMessage, setDraftMessage] = useState(() => getAgentChatPresetMessage(selectedRoutedEvent));
  const [sessionId, setSessionId] = useState<string | null>(requestedSessionId);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const existingSessionQuery = useAgentChatSession(requestedSessionId);
  const deepAgent = useDeepAgentsChatStream({
    apiClient: runtime.apiClient,
    configKey: `${selectedAgentId}:${selectedRoutedEvent}`,
    sessionId,
  });
  const { stream } = deepAgent;
  const hydratedTimeline = readTimelineMessages(deepAgent.values.timeline, existingSessionQuery.data);

  useEffect(() => {
    setSessionId(requestedSessionId);
    setSessionError(null);
    setDraftMessage(getAgentChatPresetMessage(selectedRoutedEvent));
  }, [requestedSessionId, selectedAgentId, selectedRoutedEvent]);

  useEffect(() => {
    let cancelled = false;
    if (requestedSessionId || sessionId) return;

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
  }, [agentChat, requestedSessionId, selectedAgent.agentId, selectedAgent.industryId, selectedRoutedEvent, sessionId]);

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
      artifacts: readRuntimePanelItems(deepAgent.values.artifacts, hydratedTimeline, "artifact.created"),
      interrupts: stream.interrupts.length
        ? stream.interrupts
        : Array.isArray(deepAgent.values.interrupts)
          ? deepAgent.values.interrupts
          : readRuntimePanelItems(null, hydratedTimeline, "interrupt.requested"),
      runtimeEvents: readRuntimeEvents(deepAgent.values.runtime_events, hydratedTimeline),
      subagents: Array.from(stream.subagents.values()).length
        ? Array.from(stream.subagents.values())
        : Array.isArray(deepAgent.values.subagents)
          ? deepAgent.values.subagents
          : readRuntimePanelItems(null, hydratedTimeline, "subagent.started", "subagent.completed"),
      todos: Array.isArray(deepAgent.values.todos) ? deepAgent.values.todos : readLatestTodoSnapshot(hydratedTimeline),
      toolCalls: deepAgent.toolCalls.length
        ? deepAgent.toolCalls
        : Array.isArray(deepAgent.values.tools)
          ? deepAgent.values.tools
          : readRuntimePanelItems(null, hydratedTimeline, "tool.started", "tool.completed", "tool.failed"),
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
      messages: hydratedTimeline,
      sessionId,
      status: stream.isLoading
        ? "streaming"
        : stream.error || existingSessionQuery.isError
          ? "failed"
          : stream.messages.length > 0 || existingSessionQuery.data
            ? "completed"
            : "idle",
      traceId: typeof deepAgent.values.trace_id === "string" ? deepAgent.values.trace_id : null,
    },
  };
}

function readTimelineMessages(timeline: unknown, session: ReturnType<typeof useAgentChatSession>["data"]): AgentChatTimelineItem[] {
  if (Array.isArray(timeline) && timeline.length > 0) return timeline as AgentChatTimelineItem[];
  if (!session) return [];
  return stateFromSession(session).messages;
}

function readRuntimePanelItems(current: unknown, timeline: AgentChatTimelineItem[], ...eventTypes: string[]): unknown[] {
  if (Array.isArray(current) && current.length > 0) return current;
  const wanted = new Set(eventTypes);
  return timeline.filter((item) => {
    const eventType = item.runtimeEvent?.event_type;
    return typeof eventType === "string" && wanted.has(eventType);
  });
}

function readRuntimeEvents(current: unknown, timeline: AgentChatTimelineItem[]): unknown[] {
  if (Array.isArray(current) && current.length > 0) return current;
  return timeline.filter((item) => item.runtimeEvent);
}

function readLatestTodoSnapshot(timeline: AgentChatTimelineItem[]): Array<Record<string, unknown>> {
  const todoEvent = [...timeline].reverse().find((item) => item.runtimeEvent?.event_type === "todo.updated")?.runtimeEvent;
  const todos = todoEvent?.content?.json;
  return Array.isArray(todos) ? (todos as Array<Record<string, unknown>>) : [];
}

import type {
  AgentActionFlowPart,
  AgentActionFlowStage,
  AgentArtifactPart,
  AgentChatTimelineItem,
  AgentDecisionPart,
  AgentRenderMessage,
  AgentRenderPart,
  AgentSubagentPart,
  AgentTaskItem,
  AgentToolPart,
} from "../types";
import type { AgentRuntimeEventV1 } from "../api/agent-chat.contracts";

export function agentTimelineToRenderMessages(timeline: readonly AgentChatTimelineItem[]): AgentRenderMessage[] {
  const sorted = [...timeline].sort(compareTimelineItems);
  const messages: AgentRenderMessage[] = [];
  const assistantByRun = new Map<string, AgentRenderMessage>();

  for (const item of sorted) {
    if (item.role === "user" || item.kind === "message" && item.role === "user") {
      messages.push({
        id: item.id,
        createdAt: item.createdAt,
        role: "user",
        title: "user",
        parts: [{ type: "text", text: item.content }],
      });
      continue;
    }

    const assistant = getAssistantMessage(messages, assistantByRun, item);
    mergeTimelineItemIntoAssistant(assistant, item);
  }

  return messages.filter((message) => message.parts.length > 0);
}

function compareTimelineItems(left: AgentChatTimelineItem, right: AgentChatTimelineItem): number {
  const leftSeq = Number.isFinite(left.seq) ? left.seq : Number.MAX_SAFE_INTEGER;
  const rightSeq = Number.isFinite(right.seq) ? right.seq : Number.MAX_SAFE_INTEGER;
  if (leftSeq !== rightSeq) return leftSeq - rightSeq;
  return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
}

function getAssistantMessage(
  messages: AgentRenderMessage[],
  assistantByRun: Map<string, AgentRenderMessage>,
  item: AgentChatTimelineItem,
): AgentRenderMessage {
  const key = item.runId ?? item.agentRunId ?? item.traceId ?? "agent-chat-runtime";
  const existing = assistantByRun.get(key);
  if (existing) return existing;

  const message: AgentRenderMessage = {
    id: `assistant_${key}`,
    createdAt: item.createdAt,
    role: "assistant",
    title: "Semiconductor MainAgent",
    meta: item.runId ?? item.agentRunId ?? undefined,
    parts: [],
  };
  assistantByRun.set(key, message);
  messages.push(message);
  return message;
}

function mergeTimelineItemIntoAssistant(message: AgentRenderMessage, item: AgentChatTimelineItem): void {
  const runtimeEvent = readRuntimeEventFromTimelineItem(item);
  if (runtimeEvent) {
    mergeRuntimeEventIntoAssistant(message, runtimeEvent);
    return;
  }

  if (isNonRenderableRuntimeItem(item)) {
    return;
  }

  const subagentName = readSubagentName(item);
  if (subagentName) {
    mergeTimelineItemIntoSubagent(message.parts, item, subagentName);
    return;
  }

  if (item.kind === "subagent") {
    upsertSubagentPart(message.parts, timelineItemToSubagentPart(item));
    return;
  }

  if (item.kind === "delta") {
    upsertTextPart(message.parts, item.content, "process");
    return;
  }

  if (item.kind === "final" || item.kind === "message") {
    upsertTextPart(message.parts, item.content, item.kind === "final" && item.role === "assistant" ? "response" : "process");
    return;
  }

  if (item.kind === "reasoning") {
    appendReasoningPart(message.parts, item.content, item.type);
    return;
  }

  if (item.kind === "tool") {
    const todoTasks = timelineItemToWriteTodosTasks(item);
    if (todoTasks) {
      upsertTasksPart(message.parts, todoTasks);
      return;
    }
    upsertToolPart(message.parts, timelineItemToToolPart(item));
    return;
  }

  if (item.kind === "todo") {
    upsertTasksPart(message.parts, timelineItemToTasks(item));
    return;
  }

  if (item.kind === "artifact") {
    upsertArtifactPart(message.parts, timelineItemToArtifact(item));
    return;
  }

  if (item.kind === "interrupt" || item.kind === "error") {
    message.parts.push({
      type: "notice",
      title: item.kind === "error" ? "运行失败" : "需要人工处理",
      tone: item.kind === "error" ? "danger" : "warning",
      text: item.content,
    });
    return;
  }

  if (item.content) {
    message.parts.push({
      type: "notice",
      title: readableEventTitle(item.kind),
      tone: "neutral",
      text: item.content,
    });
  }
}

function readRuntimeEventFromTimelineItem(item: AgentChatTimelineItem): AgentRuntimeEventV1 | null {
  if (item.runtimeEvent?.schema_version === "agent-runtime-event.v1") return item.runtimeEvent;
  const value = item.payload.runtime_event;
  if (value && typeof value === "object" && "schema_version" in value && value.schema_version === "agent-runtime-event.v1") {
    return value as AgentRuntimeEventV1;
  }
  return null;
}

function mergeRuntimeEventIntoAssistant(message: AgentRenderMessage, event: AgentRuntimeEventV1): void {
  if (event.render.target === "side_panel") return;

  if (event.render.lane === "subagent") {
    mergeRuntimeEventIntoSubagent(message.parts, event);
    return;
  }

  if (event.render.target === "final") {
    const text = runtimeContentText(event);
    if (text) upsertTextPart(message.parts, text, "response", event.content?.delta_mode);
    return;
  }

  if (event.render.lane !== "main") return;

  if (event.event_type === "agent.reasoning.delta") {
    appendReasoningPart(message.parts, runtimeContentText(event), event.event_type, event.content?.delta_mode);
    return;
  }
  if (event.event_type === "agent.message.delta") {
    upsertTextPart(message.parts, runtimeContentText(event), "process", event.content?.delta_mode);
    return;
  }
  if (event.event_type === "todo.updated") {
    upsertTasksPart(message.parts, runtimeEventToTasks(event));
    return;
  }
  if (event.event_type === "tool.started" || event.event_type === "tool.completed" || event.event_type === "tool.failed") {
    const todoTasks = runtimeEventToWriteTodosTasks(event);
    if (todoTasks) {
      upsertTasksPart(message.parts, todoTasks);
      return;
    }
    const toolPart = runtimeEventToToolPart(event);
    upsertActionFlowFromTool(message.parts, toolPart);
    upsertToolPart(message.parts, toolPart);
    return;
  }
  if (event.event_type === "artifact.created") {
    const artifact = runtimeEventToArtifact(event);
    upsertActionFlowFromArtifact(message.parts, artifact);
    upsertArtifactPart(message.parts, artifact);
    const decision = runtimeEventToDecision(event, artifact);
    if (decision) upsertDecisionPart(message.parts, decision);
    return;
  }
  if (event.event_type === "interrupt.requested" || event.event_type === "run.failed") {
    message.parts.push({
      type: "notice",
      title: event.event_type === "run.failed" ? "运行失败" : "需要人工处理",
      tone: event.event_type === "run.failed" ? "danger" : "warning",
      text: runtimeContentText(event),
    });
  }
}

function mergeRuntimeEventIntoSubagent(parts: AgentRenderPart[], event: AgentRuntimeEventV1): void {
  const part = ensureRuntimeSubagentPart(parts, event);
  if (event.event_type === "subagent.started") {
    part.status = "running";
    part.input = event.subagent?.input ?? part.input;
    return;
  }
  if (event.event_type === "subagent.completed") {
    part.status = "completed";
    part.output = event.subagent?.output ?? runtimeContentText(event) ?? part.output;
    return;
  }
  if (event.event_type === "agent.reasoning.delta") {
    appendReasoningPart(part.steps, runtimeContentText(event), event.event_type, event.content?.delta_mode);
    part.status = "running";
    return;
  }
  if (event.event_type === "agent.message.delta") {
    upsertTextPart(part.steps, runtimeContentText(event), "process", event.content?.delta_mode);
    part.status = "running";
    return;
  }
  if (event.event_type === "todo.updated") {
    const tasks = runtimeEventToTasks(event);
    if (tasks.length) {
      upsertTasksTextPart(part.steps, tasks);
      part.status = "running";
    }
    return;
  }
  if (event.event_type === "tool.started" || event.event_type === "tool.completed" || event.event_type === "tool.failed") {
    const todoTasks = runtimeEventToWriteTodosTasks(event);
    if (todoTasks) {
      upsertTasksTextPart(part.steps, todoTasks);
      return;
    }
    upsertToolPart(part.steps, runtimeEventToToolPart(event));
    part.status = event.event_type === "tool.failed" ? "error" : event.event_type === "tool.completed" ? "completed" : "running";
    return;
  }
  if (event.event_type === "artifact.created") {
    upsertArtifactPart(part.steps, runtimeEventToArtifact(event));
    part.status = "completed";
    return;
  }
  if (event.event_type === "interrupt.requested" || event.event_type === "run.failed") {
    part.status = event.event_type === "run.failed" ? "error" : part.status;
    part.steps.push({ display: "process", text: runtimeContentText(event), type: "text" });
  }
}

function mergeTimelineItemIntoSubagent(parts: AgentRenderPart[], item: AgentChatTimelineItem, subagentName: string): void {
  const part = ensureSubagentPart(parts, subagentName, timelineItemToSubagentTitle(item, subagentName));
  if (item.kind === "reasoning") {
    appendReasoningPart(part.steps, item.content, item.type);
    part.status = item.type?.includes("failed") ? "error" : "running";
    return;
  }
  if (item.kind === "tool") {
    const todoTasks = timelineItemToWriteTodosTasks(item);
    if (todoTasks) {
      part.steps.push({ display: "process", text: formatSubagentTasks(todoTasks), type: "text" });
      part.status = "running";
      return;
    }
    upsertToolPart(part.steps, timelineItemToToolPart(item));
    part.status = item.type === "tool.failed" ? "error" : item.type === "tool.completed" ? "completed" : "running";
    return;
  }
  if (item.kind === "delta" || item.kind === "message") {
    upsertTextPart(part.steps, item.content, "process");
    part.status = "running";
    return;
  }
  if (item.kind === "final") {
    part.output = item.content || part.output;
    part.status = "completed";
    return;
  }
  if (item.kind === "subagent") {
    const next = timelineItemToSubagentPart(item);
    part.input = next.input ?? part.input;
    part.output = next.output ?? part.output;
    part.status = next.status;
  }
}

function ensureSubagentPart(parts: AgentRenderPart[], agentName: string, title: string): AgentSubagentPart {
  const existing = parts.find((part) => part.type === "subagent" && part.agentName === agentName);
  if (existing?.type === "subagent") return existing;
  const next: AgentSubagentPart = {
    agentName,
    status: "running",
    steps: [],
    title,
    type: "subagent",
  };
  parts.push(next);
  return next;
}

function ensureRuntimeSubagentPart(parts: AgentRenderPart[], event: AgentRuntimeEventV1): AgentSubagentPart {
  const groupId = event.render.group_id;
  const agentName = event.subagent?.name ?? (event.actor.type === "subagent" ? event.actor.name : event.actor.id);
  const existing = parts.find((part) => part.type === "subagent" && (part.groupId === groupId || part.agentName === agentName));
  if (existing?.type === "subagent") {
    existing.groupId = existing.groupId ?? groupId;
    return existing;
  }
  const next: AgentSubagentPart = {
    agentName,
    groupId,
    input: event.subagent?.input ?? undefined,
    status: event.event_type === "tool.failed" || event.event_type === "run.failed" ? "error" : "running",
    steps: [],
    title: event.actor.type === "subagent" ? event.actor.display_name : event.subagent?.name ?? "SubAgent",
    type: "subagent",
  };
  parts.push(next);
  return next;
}

function isNonRenderableRuntimeItem(item: AgentChatTimelineItem): boolean {
  return item.kind === "system_event" || item.type === "run.started" || item.type === "run.completed";
}

function upsertTextPart(
  parts: AgentRenderPart[] | AgentSubagentPart["steps"],
  text: string,
  display: "process" | "response" = "process",
  deltaMode: "append" | "snapshot" | null | undefined = "snapshot",
): void {
  if (!text) return;
  const previous = parts.at(-1);
  if (previous?.type === "text" && previous.display === display) {
    previous.text = mergeTextSnapshot(previous.text, text, deltaMode);
    return;
  }
  parts.push({ type: "text", display, text });
}

function mergeTextSnapshot(current: string, next: string, deltaMode: "append" | "snapshot" | null | undefined = "append"): string {
  if (!current) return next;
  if (!next) return current;
  if (deltaMode === "append") return `${current}${next}`;
  if (next.startsWith(current)) return next;
  if (current.includes(next)) return current;
  return `${current}${next}`;
}

function appendReasoningPart(
  parts: AgentRenderPart[] | AgentSubagentPart["steps"],
  text: string,
  eventType?: string,
  deltaMode: "append" | "snapshot" | null | undefined = "snapshot",
): void {
  if (!text) return;
  const previous = parts.at(-1);
  if (previous?.type === "reasoning") {
    previous.text = mergeReasoningText(previous.text, text, deltaMode);
    previous.status = eventType?.includes("streaming") ? "streaming" : previous.status ?? "completed";
    return;
  }
  parts.push({
    type: "reasoning",
    status: eventType?.includes("streaming") ? "streaming" : "completed",
    text,
  });
}

function mergeReasoningText(current: string, next: string, deltaMode: "append" | "snapshot" | null | undefined = "append"): string {
  if (!current) return next;
  if (!next) return current;
  if (deltaMode === "append") return `${current}${next}`;
  if (next.startsWith(current)) return next;
  if (current.includes(next)) return current;
  return `${current}${next}`;
}

function upsertToolPart(parts: AgentRenderPart[], next: AgentToolPart): void {
  const index = parts.findIndex((part) => part.type === "tool" && part.callId === next.callId);
  if (index < 0) {
    parts.push(next);
    return;
  }
  const current = parts[index];
  if (current?.type !== "tool") return;
  parts[index] = {
    ...current,
    ...next,
    description: next.description ?? current.description,
    input: mergeToolInput(current.input, next.input) ?? current.input,
    output: next.output ?? current.output,
    status: next.status,
  };
}

function mergeToolInput(
  current: Record<string, unknown> | undefined,
  next: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!current) return next;
  if (!next) return current;
  return { ...current, ...next };
}

function upsertTasksPart(parts: AgentRenderPart[], tasks: AgentTaskItem[]): void {
  if (!tasks.length) return;
  const existing = parts.find((part) => part.type === "tasks");
  if (existing?.type === "tasks") {
    existing.tasks = tasks;
    return;
  }
  parts.push({ type: "tasks", title: "运行计划", tasks });
}

function ensureActionFlowPart(parts: AgentRenderPart[]): AgentActionFlowPart {
  const existing = parts.find((part) => part.type === "action_flow");
  if (existing?.type === "action_flow") return existing;
  const flow: AgentActionFlowPart = {
    stages: [
      { id: "account", label: "账户上下文", status: "pending" },
      { id: "evaluate", label: "Thesis 评估", status: "pending" },
      { id: "plan", label: "ActionPlan", status: "pending" },
      { id: "submit", label: "提交结果", status: "pending" },
    ],
    title: "行动流程",
    type: "action_flow",
  };
  const insertAt = parts.findIndex((part) => part.type === "tool" || part.type === "artifact" || part.type === "decision");
  parts.splice(insertAt < 0 ? parts.length : insertAt, 0, flow);
  return flow;
}

function upsertActionFlowFromTool(parts: AgentRenderPart[], tool: AgentToolPart): void {
  const stageId = actionStageIdFromToolName(tool.name);
  if (!stageId) return;
  updateActionFlowStage(parts, {
    id: stageId,
    label: actionStageLabel(stageId),
    status: tool.status === "completed" ? "completed" : tool.status === "error" ? "error" : "running",
    summary: tool.output ?? tool.description,
  });
}

function upsertActionFlowFromArtifact(parts: AgentRenderPart[], artifact: AgentArtifactPart): void {
  const stageId = actionStageIdFromArtifactType(artifact.artifactType);
  if (!stageId) return;
  updateActionFlowStage(parts, {
    id: stageId,
    label: actionStageLabel(stageId),
    status: "completed",
    summary: artifact.summary ?? artifact.rows.find((row) => row.label === "摘要")?.value,
  });
}

function updateActionFlowStage(parts: AgentRenderPart[], next: AgentActionFlowStage): void {
  const flow = ensureActionFlowPart(parts);
  flow.stages = flow.stages.map((stage) =>
    stage.id === next.id
      ? {
          ...stage,
          ...next,
          summary: next.summary ?? stage.summary,
        }
      : stage,
  );
}

function actionStageIdFromToolName(name: string): AgentActionFlowStage["id"] | null {
  if (name === "get_account_context") return "account";
  if (name === "evaluate_thesis") return "evaluate";
  if (name === "build_action_plan") return "plan";
  if (name === "submit_action_plan") return "submit";
  return null;
}

function actionStageIdFromArtifactType(type: AgentArtifactPart["artifactType"]): AgentActionFlowStage["id"] | null {
  if (type === "thesis") return "evaluate";
  if (type === "action_plan") return "plan";
  if (type === "submission") return "submit";
  return null;
}

function actionStageLabel(id: AgentActionFlowStage["id"]): string {
  if (id === "account") return "账户上下文";
  if (id === "evaluate") return "Thesis 评估";
  if (id === "plan") return "ActionPlan";
  return "提交结果";
}

function upsertTasksTextPart(parts: AgentSubagentPart["steps"], tasks: AgentTaskItem[]): void {
  if (!tasks.length) return;
  const text = formatSubagentTasks(tasks);
  const existing = parts.find((part) => part.type === "text" && part.display === "process" && part.text.includes("- ["));
  if (existing?.type === "text") {
    existing.text = text;
    return;
  }
  parts.push({ display: "process", text, type: "text" });
}

function upsertSubagentPart(parts: AgentRenderPart[], next: AgentSubagentPart): void {
  const current = ensureSubagentPart(parts, next.agentName, next.title);
  current.input = next.input ?? current.input;
  current.output = next.output ?? current.output;
  current.status = next.status;
  if (next.steps.length) current.steps = mergeSubagentSteps(current.steps, next.steps);
}

function upsertArtifactPart(parts: AgentRenderPart[] | AgentSubagentPart["steps"], next: AgentArtifactPart): void {
  const index = parts.findIndex((part) => part.type === "artifact" && artifactIdentity(part) === artifactIdentity(next));
  if (index < 0) {
    parts.push(next);
    return;
  }
  const current = parts[index];
  if (current?.type !== "artifact") return;
  parts[index] = mergeArtifactPart(current, next);
}

function upsertDecisionPart(parts: AgentRenderPart[], next: AgentDecisionPart): void {
  const index = parts.findIndex((part) => part.type === "decision" && part.title === next.title);
  if (index < 0) {
    parts.push(next);
    return;
  }
  parts[index] = next;
}

function mergeArtifactPart(current: AgentArtifactPart, next: AgentArtifactPart): AgentArtifactPart {
  const currentMarkdownLength = current.contentMarkdown?.length ?? 0;
  const nextMarkdownLength = next.contentMarkdown?.length ?? 0;
  const currentSeq = current.sourceSeq ?? 0;
  const nextSeq = next.sourceSeq ?? 0;
  const preferred =
    current.artifactType === "report" && next.artifactType === "report" && nextSeq >= currentSeq
      ? next
      : nextMarkdownLength >= currentMarkdownLength
        ? next
        : current;
  const fallback = preferred === next ? current : next;
  return {
    ...fallback,
    ...preferred,
    artifactId: preferred.artifactId ?? fallback.artifactId,
    contentMarkdown: preferred.contentMarkdown ?? fallback.contentMarkdown,
    rows: preferred.rows.length ? preferred.rows : fallback.rows,
    sourceSeq: Math.max(preferred.sourceSeq ?? 0, fallback.sourceSeq ?? 0) || undefined,
    summary: preferred.summary ?? fallback.summary,
  };
}

function artifactIdentity(part: AgentArtifactPart): string {
  if (part.artifactType === "report") return `report:${part.groupId ?? ""}`;
  if (part.artifactId) return part.artifactId;
  return `${part.artifactType}:${part.groupId ?? ""}:${part.title}`;
}

function mergeSubagentSteps(
  current: AgentSubagentPart["steps"],
  next: AgentSubagentPart["steps"],
): AgentSubagentPart["steps"] {
  const merged = current.slice();
  for (const step of next) {
    if (step.type === "tool") upsertToolPart(merged, step);
    else if (step.type === "artifact") upsertArtifactPart(merged, step);
    else merged.push(step);
  }
  return merged;
}

function timelineItemToSubagentPart(item: AgentChatTimelineItem): AgentSubagentPart {
  const agentName = readSubagentName(item) ?? readString(item.payload.name) ?? "subagent";
  const subagents = Array.isArray(item.payload.subagents) ? item.payload.subagents : [];
  const matched = subagents.find((subagent) => isRecord(subagent) && readString(subagent.name) === agentName);
  const record = isRecord(matched) ? matched : isRecord(item.payload) ? item.payload : {};
  return {
    agentName,
    input: readString(record.input) ?? readString(record.task) ?? readString(record.instruction) ?? undefined,
    output: readString(record.output) ?? readString(record.result) ?? item.content,
    status: item.type === "subagent.started" ? "running" : item.type === "subagent.completed" ? "completed" : "running",
    steps: [],
    title: timelineItemToSubagentTitle(item, agentName),
    type: "subagent",
  };
}

function timelineItemToSubagentTitle(item: AgentChatTimelineItem, agentName: string): string {
  if (agentName === "evidence_research_analyst") return "Research Agent";
  return readString(item.payload.title) ?? agentName;
}

function readSubagentName(item: AgentChatTimelineItem): string | null {
  if (readString(item.payload.actor_type) !== "subagent") return null;
  const direct = readString(item.payload.subagent_name) ?? readString(item.payload.subagent) ?? readString(item.payload.subagent_id);
  if (direct && !isReservedGraphNodeName(direct)) return direct;
  return null;
}

function isReservedGraphNodeName(name: string): boolean {
  return ["agent", "model", "tool", "tools"].includes(name);
}

function formatSubagentTasks(tasks: AgentTaskItem[]): string {
  return tasks.map((task) => `- [${task.status === "completed" ? "x" : " "}] ${task.label}`).join("\n");
}

function timelineItemToWriteTodosTasks(item: AgentChatTimelineItem): AgentTaskItem[] | null {
  const identity = readToolIdentity(item.payload);
  if (identity.toolName !== "write_todos") return null;
  const candidates = [item.payload.input, item.payload.args, item.payload.result, item.payload.output, item.payload.message, item.content];
  for (const candidate of candidates) {
    const todos = extractTodos(candidate);
    if (todos.length) return todos;
  }
  return [];
}

function runtimeEventToWriteTodosTasks(event: AgentRuntimeEventV1): AgentTaskItem[] | null {
  if (event.tool?.name !== "write_todos") return null;
  const candidates = [event.tool.input, event.tool.output, event.content?.json, event.content?.text];
  for (const candidate of candidates) {
    const todos = extractTodos(candidate);
    if (todos.length) return todos;
  }
  return [];
}

function timelineItemToToolPart(item: AgentChatTimelineItem): AgentToolPart {
  const identity = readToolIdentity(item.payload);
  const status = item.type === "tool.started" ? "running" : item.type === "tool.failed" ? "error" : "completed";
  const input = readToolInput(item.payload);
  const output = status === "running" ? undefined : readToolOutput(item);
  return {
    type: "tool",
    callId: identity.callId ?? item.id,
    name: identity.toolName ?? "tool",
    status,
    description: status === "running" ? item.content : undefined,
    input,
    output,
  };
}

function runtimeEventToToolPart(event: AgentRuntimeEventV1): AgentToolPart {
  const status = event.event_type === "tool.started" ? "running" : event.event_type === "tool.failed" ? "error" : "completed";
  return {
    type: "tool",
    callId: event.tool?.call_id ?? event.event_id,
    name: event.tool?.name ?? event.actor.name,
    status,
    description: status === "running" ? runtimeContentText(event) : undefined,
    input: recordOrUndefined(event.tool?.input),
    output: status === "running" ? undefined : runtimeToolOutput(event),
  };
}

function readToolIdentity(payload: Record<string, unknown>): { callId: null | string; toolName: null | string } {
  const message = isRecord(payload.message) ? payload.message : null;
  const raw = isRecord(payload.raw) ? payload.raw : null;
  return {
    callId:
      readString(payload.invocation_id) ??
      readString(payload.tool_call_id) ??
      readString(payload.call_id) ??
      readString(message?.tool_call_id) ??
      readString(message?.id) ??
      readString(raw?.id) ??
      readString(raw?.tool_call_id),
    toolName:
      readString(payload.tool_name) ??
      readString(payload.name) ??
      readString(message?.name) ??
      readString(message?.tool_name) ??
      readString(raw?.name) ??
      readString(raw?.tool_name) ??
      readString(payload.tool_id) ??
      readString(message?.tool_id),
  };
}

function readToolInput(payload: Record<string, unknown>): Record<string, unknown> | undefined {
  const direct = payload.input ?? payload.args;
  if (isRecord(direct)) return direct;
  if (typeof direct === "string" && direct) return parseJsonRecord(direct) ?? undefined;
  const raw = isRecord(payload.raw) ? payload.raw : null;
  const rawArgs = raw?.args ?? raw?.arguments ?? raw?.input;
  if (isRecord(rawArgs)) return rawArgs;
  if (typeof rawArgs === "string" && rawArgs) return parseJsonRecord(rawArgs) ?? undefined;
  const compact: Record<string, unknown> = {};
  for (const key of ["query", "symbol", "symbols", "window"]) {
    const value = payload[key];
    if (isPrimitive(value) || Array.isArray(value)) compact[key] = value;
  }
  return Object.keys(compact).length ? compact : undefined;
}

function readToolOutput(item: AgentChatTimelineItem): string | undefined {
  const structured = item.payload.result ?? item.payload.output ?? item.payload.error;
  const formatted = formatUnknownOutput(structured);
  if (formatted) return formatted;
  const message = isRecord(item.payload.message) ? item.payload.message : null;
  const content = readString(message?.content) ?? item.content;
  if (!content || content.startsWith("Tool ") && content.endsWith(".")) return undefined;
  return content;
}

function formatUnknownOutput(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") return value;
  if (isRecord(value)) {
    const summary = summarizeToolObject(value);
    if (summary) return summary;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function summarizeToolObject(value: Record<string, unknown>): string | undefined {
  const lines: string[] = [];
  const summary = readString(value.summary) ?? readString(value.safe_summary) ?? readString(value.reason_summary);
  if (summary) lines.push(summary);

  for (const key of [
    "ok",
    "context_id",
    "search_id",
    "account_context_id",
    "evaluation_id",
    "thesis_evaluation_artifact_id",
    "action_plan_id",
    "action_plan_artifact_id",
    "submission_id",
    "resolved_mode",
    "execution_status",
    "notification_status",
  ]) {
    const formatted = formatArtifactValue(value[key]);
    if (formatted) lines.push(`- **${key}:** ${formatted}`);
  }

  if (Array.isArray(value.warnings) && value.warnings.length) {
    lines.push(`- **warnings:** ${value.warnings.map(formatArtifactValue).join("; ")}`);
  }
  if (Array.isArray(value.results) && value.results.length) {
    lines.push(`- **results:** ${value.results.length} 条`);
  }
  if (Array.isArray(value.sections) && value.sections.length) {
    lines.push(`- **sections:** ${value.sections.length} 个`);
  }
  if (Array.isArray(value.orders) && value.orders.length) {
    lines.push(`- **orders:** ${value.orders.length} 条`);
  }

  return lines.length ? lines.join("\n") : undefined;
}

function parseJsonRecord(value: string): Record<string, unknown> | undefined {
  const parsed = parseJsonUnknown(value);
  return isRecord(parsed) ? parsed : undefined;
}

function parseJsonUnknown(value: string): unknown | undefined {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function timelineItemToTasks(item: AgentChatTimelineItem): AgentTaskItem[] {
  return normalizeTodos(Array.isArray(item.payload.todos) ? item.payload.todos : []);
}

function runtimeEventToTasks(event: AgentRuntimeEventV1): AgentTaskItem[] {
  const value = event.content?.json ?? event.raw;
  return Array.isArray(value) ? normalizeTodos(value) : extractTodos(value);
}

function extractTodos(value: unknown): AgentTaskItem[] {
  if (isRecord(value)) {
    if (Array.isArray(value.todos)) return normalizeTodos(value.todos);
    if (typeof value.content === "string") return extractTodos(value.content);
    if (value.result !== undefined) return extractTodos(value.result);
    if (value.output !== undefined) return extractTodos(value.output);
  }
  if (typeof value === "string") {
    const parsed = parseJsonUnknown(value);
    if (parsed !== undefined) return extractTodos(parsed);
    const listLiteral = extractPythonTodoListLiteral(value);
    if (listLiteral) return normalizeTodos(parsePythonTodoList(listLiteral));
  }
  return [];
}

function normalizeTodos(raw: unknown[]): AgentTaskItem[] {
  return raw
    .map((todo, index): AgentTaskItem | null => {
      if (!isRecord(todo)) return null;
      const label = readString(todo.label) ?? readString(todo.content) ?? readString(todo.title);
      if (!label) return null;
      return {
        id: readString(todo.id) ?? `todo_${index}`,
        label,
        description: readString(todo.description) ?? undefined,
        status: normalizeTaskStatus(readString(todo.status)),
      };
    })
    .filter((task): task is AgentTaskItem => Boolean(task));
}

function extractPythonTodoListLiteral(value: string): string | null {
  const marker = "Updated todo list to ";
  const markerIndex = value.indexOf(marker);
  const start = value.indexOf("[", markerIndex >= 0 ? markerIndex + marker.length : 0);
  const end = value.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  return value.slice(start, end + 1);
}

function parsePythonTodoList(value: string): unknown[] {
  try {
    const jsonLike = value
      .replaceAll("\\", "\\\\")
      .replaceAll("'", "\"")
      .replace(/\bNone\b/g, "null")
      .replace(/\bTrue\b/g, "true")
      .replace(/\bFalse\b/g, "false");
    const parsed = JSON.parse(jsonLike) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function timelineItemToArtifact(item: AgentChatTimelineItem): AgentArtifactPart {
  return {
    type: "artifact",
    artifactId: readString(item.payload.artifact_id) ?? undefined,
    artifactType: "analysis",
    title: readableEventTitle(item.kind),
    tone: "info",
    rows: objectRows(item.payload).length ? objectRows(item.payload) : [{ label: "内容", value: item.content }],
  };
}

function runtimeEventToArtifact(event: AgentRuntimeEventV1): AgentArtifactPart {
  const payload = isRecord(event.content?.json) ? event.content.json : isRecord(event.raw) ? event.raw : {};
  const artifactRecord = isRecord(payload.artifact) ? payload.artifact : payload;
  const artifactPayload = isRecord(payload.payload) ? payload.payload : {};
  const artifactKind = readString(payload.kind) ?? readString(artifactRecord.kind);
  const artifactType = normalizeArtifactType(readString(artifactRecord.artifact_type) ?? readString(artifactRecord.type) ?? artifactKind);
  const title = artifactTitle(artifactType, artifactRecord, artifactPayload);
  const contentMarkdown =
    readString(artifactRecord.content_markdown) ??
    readString(artifactRecord.markdown) ??
    readString(artifactRecord.content) ??
    runtimeContentText(event);
  const summary = readString(artifactRecord.summary) ?? readString(artifactPayload.summary) ?? summarizeMarkdown(contentMarkdown);
  const rows = artifactRows(artifactType, artifactPayload, artifactRecord);
  return {
    type: "artifact",
    artifactId: readString(artifactRecord.artifact_id) ?? undefined,
    artifactType,
    agentName: readString(artifactRecord.agent_display_name) ?? readString(artifactRecord.agent_name) ?? event.actor.display_name,
    contentMarkdown: contentMarkdown || undefined,
    groupId: readString(artifactRecord.group_id) ?? event.render.group_id,
    sourceSeq: typeof artifactRecord.source_seq === "number" ? artifactRecord.source_seq : event.seq,
    summary: summary || undefined,
    title,
    tone: "info",
    rows: rows.length ? rows : [{ label: "来源", value: event.actor.display_name }],
  };
}

function runtimeEventToDecision(event: AgentRuntimeEventV1, artifact: AgentArtifactPart): AgentDecisionPart | null {
  if (artifact.artifactType !== "submission") return null;
  const payload = runtimeArtifactPayload(event);
  const resolvedMode = readString(payload.resolved_mode);
  const status: AgentDecisionPart["status"] =
    resolvedMode === "execute_then_notify"
      ? "auto_approved"
      : resolvedMode === "approval_required" || resolvedMode === "approval_with_timeout"
        ? "needs_human"
        : resolvedMode === "blocked"
          ? "blocked"
          : "no_action";
  return {
    action: resolvedMode ?? "submission",
    confidence: 0.92,
    rationale: readString(payload.summary) ?? artifact.summary ?? "行动计划已提交到平台状态机。",
    risk: readString(isRecord(payload.policy_gate) ? payload.policy_gate.reason : undefined) ?? "MVP 使用 dry-run/mock 执行边界。",
    status,
    title: "行动结果",
    type: "decision",
  };
}

function runtimeArtifactPayload(event: AgentRuntimeEventV1): Record<string, unknown> {
  const payload = isRecord(event.content?.json) ? event.content.json : isRecord(event.raw) ? event.raw : {};
  return isRecord(payload.payload) ? payload.payload : {};
}

function normalizeArtifactType(value: null | string): AgentArtifactPart["artifactType"] {
  if (value === "thesis_evaluation") return "thesis";
  if (value === "action_plan") return "action_plan";
  if (value === "submission_result") return "submission";
  if (value === "notification" || value === "order" || value === "report" || value === "risk") return value;
  return "analysis";
}

function artifactTitle(type: AgentArtifactPart["artifactType"], artifact: Record<string, unknown>, payload: Record<string, unknown>): string {
  const explicit = readString(artifact.title) ?? readString(payload.title);
  if (explicit) return explicit;
  const producerId = readString(artifact.producer_id) ?? readString(payload.producer_id);
  const kind = readString(artifact.kind) ?? readString(payload.kind);
  const producerTitle = artifactTitleFromProducer(producerId, kind);
  if (producerTitle) return producerTitle;
  if (type === "thesis") return "Thesis 评估";
  if (type === "action_plan") return "ActionPlan";
  if (type === "submission") return "行动提交结果";
  if (type === "report") return "分析报告";
  if (type === "analysis") return "行业分析报告";
  return "运行产物";
}

function artifactTitleFromProducer(producerId: null | string, kind: null | string): string | null {
  if (producerId?.endsWith("get_account_context")) return "账户上下文";
  if (producerId?.endsWith("evaluate_thesis")) return "Thesis 评估";
  if (producerId?.endsWith("build_action_plan")) return "ActionPlan";
  if (producerId?.endsWith("submit_action_plan")) return "行动提交结果";
  if (kind === "tool_result") return "工具运行结果";
  if (kind === "industry_analysis") return "行业分析报告";
  return null;
}

function artifactRows(
  type: AgentArtifactPart["artifactType"],
  payload: Record<string, unknown>,
  artifact: Record<string, unknown>,
): Array<{ label: string; value: string }> {
  if (type === "thesis") {
    return compactRows([
      ["建议", payload.suggested_intent],
      ["置信度", percentValue(payload.confidence_score)],
      ["风险", payload.risk_level],
      ["关系", payload.event_relationship],
      ["理由", payload.reason_summary],
    ]);
  }
  if (type === "action_plan") {
    const firstOrder = Array.isArray(payload.orders) && isRecord(payload.orders[0]) ? payload.orders[0] : {};
    const riskControls = isRecord(payload.risk_controls) ? payload.risk_controls : {};
    return compactRows([
      ["动作", payload.intended_action],
      ["标的", Array.isArray(payload.target_symbols) ? payload.target_symbols.join(", ") : payload.target_symbols],
      ["规模", currencyValue(firstOrder.notional_usd)],
      ["组合占比", percentValue(firstOrder.portfolio_pct)],
      ["止损", percentValue(riskControls.stop_loss_pct)],
      ["止盈", percentValue(riskControls.take_profit_pct)],
      ["摘要", payload.summary],
    ]);
  }
  if (type === "submission") {
    return compactRows([
      ["模式", payload.resolved_mode],
      ["Broker", payload.broker_mode],
      ["执行", payload.execution_status],
      ["通知", payload.notification_status],
      ["监控", payload.monitoring_status],
      ["幂等键", payload.idempotency_key],
      ["摘要", payload.summary],
    ]);
  }
  const rows = objectRows(artifact);
  return rows.length ? rows : objectRows(payload);
}

function compactRows(items: Array<[string, unknown]>): Array<{ label: string; value: string }> {
  return items
    .map(([label, value]) => ({ label, value: formatArtifactValue(value) }))
    .filter((row) => row.value.length > 0);
}

function formatArtifactValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(formatArtifactValue).filter(Boolean).join(", ");
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function percentValue(value: unknown): string {
  if (typeof value !== "number") return formatArtifactValue(value);
  const scaled = Math.abs(value) <= 1 ? value * 100 : value;
  return `${Number(scaled.toFixed(1))}%`;
}

function currencyValue(value: unknown): string {
  if (typeof value !== "number") return formatArtifactValue(value);
  return new Intl.NumberFormat("zh-CN", { currency: "USD", maximumFractionDigits: 0, style: "currency" }).format(value);
}

function summarizeMarkdown(value: null | string): string | undefined {
  if (!value) return undefined;
  for (const line of value.split("\n")) {
    const cleaned = line.replace(/^#+\s*/, "").trim();
    if (cleaned && !cleaned.startsWith("|") && cleaned !== "---") return cleaned.slice(0, 180);
  }
  const compact = value.replace(/\s+/g, " ").trim();
  return compact ? compact.slice(0, 180) : undefined;
}

function runtimeContentText(event: AgentRuntimeEventV1): string {
  if (typeof event.content?.text === "string") return event.content.text;
  if (typeof event.tool?.error?.message === "string") return event.tool.error.message;
  if (typeof event.subagent?.output === "string") return event.subagent.output;
  return "";
}

function runtimeToolOutput(event: AgentRuntimeEventV1): string | undefined {
  if (event.tool?.error) return event.tool.error.message;
  return formatUnknownOutput(event.tool?.output ?? event.content?.json ?? event.content?.text);
}

function recordOrUndefined(value: unknown): Record<string, unknown> | undefined {
  if (isRecord(value)) return value;
  return undefined;
}

function objectRows(payload: Record<string, unknown>): Array<{ label: string; value: string }> {
  return Object.entries(payload)
    .filter(([, value]) => isPrimitive(value))
    .slice(0, 6)
    .map(([label, value]) => ({ label, value: String(value) }));
}

function normalizeTaskStatus(status: null | string): AgentTaskItem["status"] {
  if (status === "completed" || status === "done" || status === "success") return "completed";
  if (status === "error" || status === "failed") return "error";
  if (status === "in_progress" || status === "running") return "in_progress";
  return "pending";
}

function readableEventTitle(kind: string): string {
  if (kind === "artifact") return "运行产物";
  if (kind === "system_event") return "运行事件";
  return kind;
}

function readString(value: unknown): null | string {
  return typeof value === "string" && value ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPrimitive(value: unknown): value is boolean | number | string {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

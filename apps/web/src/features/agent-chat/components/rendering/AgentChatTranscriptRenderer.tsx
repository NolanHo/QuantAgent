import type { AgentRenderMessage, AgentRenderPart } from "../../types";
import { Conversation, ConversationContent, ConversationDownload, ConversationEmptyState, Message } from "./AgentChatElements";
import { AgentChainOfThought } from "./agent-chain-of-thought";
import { AgentRenderPartView } from "./AgentRenderParts";

type AssistantRenderBlock =
  | {
      id: string;
      parts: AgentRenderPart[];
      type: "cot";
    }
  | {
      id: string;
      part: AgentRenderPart;
      type: "part";
    };

export function AgentChatTranscriptRenderer({
  className,
  contentClassName,
  messages,
  showDownload = true,
}: {
  className?: string;
  contentClassName?: string;
  messages: readonly AgentRenderMessage[];
  showDownload?: boolean;
}) {
  const markdown = messagesToMarkdown(messages);

  return (
    <Conversation className={className}>
      {showDownload && messages.length ? <ConversationDownload content={markdown} filename="agent-chat-transcript.md" /> : null}
      <ConversationContent className={contentClassName ?? "max-h-[calc(100vh-18rem)] pr-2"}>
        {messages.length ? (
          messages.map((message) => (
            <Message from={message.role} key={message.id} meta={message.meta ?? formatTime(message.createdAt)} title={message.title}>
              <MessageParts message={message} />
            </Message>
          ))
        ) : (
          <ConversationEmptyState description="选择一个调试场景来预览 Agent Chat 消息渲染。" title="暂无消息" />
        )}
      </ConversationContent>
    </Conversation>
  );
}

function MessageParts({ message }: { message: AgentRenderMessage }) {
  if (message.role !== "assistant") {
    return (
      <>
        {message.parts.map((part, index) => (
          <AgentRenderPartView key={`${message.id}-${part.type}-${index}`} part={part} />
        ))}
      </>
    );
  }

  const blocks = groupAssistantParts(message.parts);

  return (
    <>
      {blocks.map((block) =>
        block.type === "cot" ? (
          <AgentChainOfThought key={`${message.id}-${block.id}`} parts={block.parts} />
        ) : (
          <AgentRenderPartView key={`${message.id}-${block.id}`} part={block.part} />
        ),
      )}
    </>
  );
}

export function groupAssistantParts(parts: readonly AgentRenderPart[]): AssistantRenderBlock[] {
  const blocks: AssistantRenderBlock[] = [];
  let currentCot: AgentRenderPart[] = [];
  let cotIndex = 0;

  const flushCot = () => {
    if (!currentCot.length) return;
    blocks.push({ id: `cot-${cotIndex}`, parts: currentCot, type: "cot" });
    cotIndex += 1;
    currentCot = [];
  };

  parts.forEach((part, index) => {
    if (part.type === "text" && part.display === "response") {
      flushCot();
      blocks.push({ id: `response-${index}`, part, type: "part" });
      return;
    }
    currentCot.push(part);
  });

  flushCot();
  return blocks;
}

function messagesToMarkdown(messages: readonly AgentRenderMessage[]) {
  return messages
    .map((message) => {
      const body = message.parts.map(partToMarkdown).filter(Boolean).join("\n\n");
      return `## ${message.title ?? message.role}\n\n${body}`;
    })
    .join("\n\n");
}

function partToMarkdown(part: AgentRenderPart): string {
  switch (part.type) {
    case "action_flow":
      return [
        `### ${part.title}`,
        ...part.stages.map((stage) => `- **${stage.label}:** ${stage.status}${stage.summary ? ` — ${stage.summary}` : ""}`),
      ].join("\n");
    case "artifact":
      return [`### ${part.title}`, ...part.rows.map((row) => `- **${row.label}:** ${row.value}`)].join("\n");
    case "decision":
      return [`### ${part.title}`, part.rationale, `- action: ${part.action}`, `- confidence: ${Math.round(part.confidence * 100)}%`, `- risk: ${part.risk}`].join("\n");
    case "notice":
      return `### ${part.title}\n${part.text}`;
    case "reasoning":
      return `### ${part.title ?? "推理过程"}\n${part.text}`;
    case "sources":
      return [`### ${part.title ?? "参考来源"}`, ...part.sources.map((source) => `- ${source.label}${source.meta ? ` (${source.meta})` : ""}`)].join("\n");
    case "subagent":
      return [`### ${part.title}`, part.input ? `Input: ${part.input}` : "", ...part.steps.map(partToMarkdown), part.output ? `Output: ${part.output}` : ""].filter(Boolean).join("\n\n");
    case "tasks":
      return [`### ${part.title}`, ...part.tasks.map((task) => `- [${task.status === "completed" ? "x" : " "}] ${task.label}`)].join("\n");
    case "text":
      return part.text;
    case "tool":
      return `### Tool: ${part.name}\n${part.output ?? part.description ?? ""}`;
  }
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

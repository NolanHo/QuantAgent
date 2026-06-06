import { agentTimelineToRenderMessages } from "../../utils";
import { AgentChatTranscriptRenderer } from "../rendering";
import type { AgentTimelineDisplayItem } from "./AgentMessageBubble";

export function AgentMessageList({
  isStreaming = false,
  messages,
}: {
  isStreaming?: boolean;
  messages: readonly AgentTimelineDisplayItem[];
}) {
  if (!messages.length) {
    return (
      <div className="grid min-h-80 place-items-center rounded-lg border border-dashed border-hairline bg-canvas p-8 text-center">
        <div className="grid max-w-md gap-2">
          <div className="text-title-sm font-bold text-ink">开始一次 Agent Runtime 对话</div>
          <div className="text-[14px] leading-6 text-muted-strong">
            主消息流会展示 DeepAgents 的 assistant token、reasoning、tool、todo、SubAgent、artifact 和 interrupt；原始 runtime event 留在右侧面板。
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <AgentChatTranscriptRenderer
        contentClassName="max-h-none overflow-visible p-0"
        messages={agentTimelineToRenderMessages(messages)}
        showDownload={false}
      />
      {isStreaming ? (
        <div className="flex items-center gap-2 px-2 text-[12px] font-semibold text-muted-strong">
          <span className="size-2 animate-pulse rounded-full bg-primary" />
          DeepAgents streaming
        </div>
      ) : null}
    </div>
  );
}

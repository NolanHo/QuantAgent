import { Button } from "@heroui/react";
import { Send, Square } from "lucide-react";

export function AgentChatComposer({
  canSend,
  draftMessage,
  isStreaming,
  onAbort,
  onDraftMessageChange,
  onSend,
}: {
  canSend: boolean;
  draftMessage: string;
  isStreaming: boolean;
  onAbort(): void;
  onDraftMessageChange(value: string): void;
  onSend(): void;
}) {
  const submitStatus = isStreaming ? "streaming" : canSend ? "ready" : "disabled";
  return (
    <section className="grid gap-2">
      <div className="relative rounded-lg border border-hairline bg-canvas shadow-sm transition focus-within:border-primary/60">
        <textarea
          className="min-h-24 w-full resize-none rounded-lg bg-transparent px-3 py-3 pr-12 text-[14px] leading-6 text-ink outline-none placeholder:text-muted"
          placeholder="输入事件、问题或调试指令..."
          value={draftMessage}
          onChange={(event) => onDraftMessageChange(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              if (canSend) onSend();
            }
          }}
        />
        <div className="absolute bottom-2 right-2">
          {isStreaming ? (
            <Button isIconOnly aria-label="停止 Agent run" size="sm" type="button" variant="ghost" onPress={onAbort}>
              <Square aria-hidden className="size-4" />
            </Button>
          ) : (
            <Button isIconOnly aria-label="发送消息" isDisabled={!canSend} size="sm" type="button" variant="primary" onPress={onSend}>
              <Send aria-hidden className="size-4" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 text-[11px] text-muted-strong">
        <span>DeepAgents ChatApp stream</span>
        <span className="rounded bg-surface-soft px-2 py-0.5 font-mono">{submitStatus}</span>
      </div>
    </section>
  );
}

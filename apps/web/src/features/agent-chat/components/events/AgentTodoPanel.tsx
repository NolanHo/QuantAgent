import type { AgentChatDisplayMessage } from "../../types";

export function AgentTodoPanel({ message }: { message: AgentChatDisplayMessage }) {
  return (
    <article className="rounded-lg border border-hairline bg-surface-soft p-3">
      <div className="mb-1 text-[12px] font-semibold uppercase text-muted-strong">todo</div>
      <p className="m-0 text-[13px] leading-5 text-ink">{message.content}</p>
    </article>
  );
}


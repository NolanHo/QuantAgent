import type { AgentChatDisplayMessage } from "../../types";

export function AgentInterruptCard({ message }: { message: AgentChatDisplayMessage }) {
  return (
    <article className="rounded-lg border border-warning/40 bg-warning/10 p-3">
      <div className="mb-1 text-[12px] font-semibold uppercase text-muted-strong">approval</div>
      <p className="m-0 text-[13px] leading-5 text-ink">{message.content}</p>
    </article>
  );
}


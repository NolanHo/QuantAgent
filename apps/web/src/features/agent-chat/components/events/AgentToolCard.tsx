import type { AgentChatDisplayMessage } from "../../types";

export function AgentToolCard({ message }: { message: AgentChatDisplayMessage }) {
  return <EventCard label="tool" message={message} />;
}

function EventCard({ label, message }: { label: string; message: AgentChatDisplayMessage }) {
  return (
    <article className="rounded-lg border border-hairline bg-canvas p-3">
      <div className="mb-1 text-[12px] font-semibold uppercase text-muted-strong">{label}</div>
      <p className="m-0 whitespace-pre-wrap text-[13px] leading-5 text-ink">{message.content}</p>
    </article>
  );
}


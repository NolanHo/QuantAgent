export function AgentChatErrorState({ message }: { message: string }) {
  return <div className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-[13px] text-danger">{message}</div>;
}


export const agentChatQueryKeys = {
  all: ["agent-chat"] as const,
  session: (sessionId: string | null) => [...agentChatQueryKeys.all, "session", sessionId] as const,
};


import { useQuery } from "@tanstack/react-query";

import { useApis } from "@/app/runtime";

import { agentChatQueryKeys } from "./agent-chat.keys";

export function useAgentChatSession(sessionId: string | null) {
  const { agentChat } = useApis();

  return useQuery({
    enabled: Boolean(sessionId),
    queryFn: () => agentChat.getSession(sessionId as string),
    queryKey: agentChatQueryKeys.session(sessionId),
  });
}


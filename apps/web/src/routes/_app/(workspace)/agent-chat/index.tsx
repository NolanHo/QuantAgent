import { createFileRoute } from "@tanstack/react-router";

import { AgentChatPage, normalizeAgentChatSearch } from "@/features/agent-chat";

export const Route = createFileRoute("/_app/(workspace)/agent-chat/")({
  validateSearch: normalizeAgentChatSearch,
  component: AgentChatRoute,
});

function AgentChatRoute() {
  const search = Route.useSearch();
  return <AgentChatPage search={search} />;
}

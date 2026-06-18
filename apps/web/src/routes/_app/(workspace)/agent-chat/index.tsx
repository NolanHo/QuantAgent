import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { AgentChatPage, normalizeAgentChatSearch } from "@/features/agent-chat";
import type { AgentChatIndustryAgentId, AgentChatRoutedEventPreset } from "@/features/agent-chat";

export const Route = createFileRoute("/_app/(workspace)/agent-chat/")({
  validateSearch: normalizeAgentChatSearch,
  component: AgentChatRoute,
});

function AgentChatRoute() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <AgentChatPage
      search={search}
      onAgentChange={(agent: AgentChatIndustryAgentId) => {
        void navigate({ search: (current: Record<string, unknown>) => normalizeAgentChatSearch({ ...current, agent }) });
      }}
      onRoutedEventChange={(routedEvent: AgentChatRoutedEventPreset) => {
        void navigate({
          search: (current: Record<string, unknown>) => normalizeAgentChatSearch({ ...current, routedEvent, preset: routedEvent }),
        });
      }}
    />
  );
}

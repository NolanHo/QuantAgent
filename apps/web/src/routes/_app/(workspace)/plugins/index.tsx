import { createFileRoute } from "@tanstack/react-router";

import { PluginsIndexPage } from "@/features/plugins/detail";

export const Route = createFileRoute("/_app/(workspace)/plugins/")({
  component: PluginsPage,
});

function PluginsPage() {
  return <PluginsIndexPage />;
}

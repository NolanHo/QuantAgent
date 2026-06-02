import { createFileRoute } from "@tanstack/react-router";

import { PluginDetailPage as PluginDetailFeaturePage } from "@/features/plugins/detail";

export const Route = createFileRoute("/_app/(workspace)/plugins/$pluginId")({
  component: PluginDetailRoutePage,
});

function PluginDetailRoutePage() {
  const { pluginId } = Route.useParams();

  return <PluginDetailFeaturePage pluginId={pluginId} />;
}

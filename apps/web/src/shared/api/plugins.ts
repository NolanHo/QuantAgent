import type { PluginConfigJsonSchema } from "@/features/plugins/config-form";

import type { ApiClient } from "./client";

export function fetchPluginConfigJsonSchema(
  apiClient: ApiClient,
  pluginId: string,
): Promise<PluginConfigJsonSchema> {
  return apiClient.get<PluginConfigJsonSchema>(
    `/plugins/${pluginId}/config-schema`,
    { dedupeKey: `plugin-config-schema:${pluginId}` },
  );
}

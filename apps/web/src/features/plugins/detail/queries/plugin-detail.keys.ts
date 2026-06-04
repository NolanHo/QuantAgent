export const pluginDetailKeys = {
  all: ["plugins", "detail"] as const,
  audit: (pluginId: string) => [...pluginDetailKeys.detail(pluginId), "audit"] as const,
  config: (pluginId: string) => [...pluginDetailKeys.detail(pluginId), "config"] as const,
  dependencies: (pluginId: string) =>
    [...pluginDetailKeys.detail(pluginId), "dependencies"] as const,
  detail: (pluginId: string) => [...pluginDetailKeys.all, pluginId] as const,
  health: (pluginId: string) => [...pluginDetailKeys.detail(pluginId), "health"] as const,
  list: () => ["plugins", "list"] as const,
};

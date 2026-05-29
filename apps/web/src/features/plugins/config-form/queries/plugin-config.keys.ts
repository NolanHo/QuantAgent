export const pluginConfigKeys = {
  config: (pluginId: string) => ['plugin-current-config', pluginId] as const,
  schema: (pluginId: string) => ['plugin-config-schema', pluginId] as const,
}

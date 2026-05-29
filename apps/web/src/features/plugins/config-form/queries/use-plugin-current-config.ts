import { useQuery } from '@tanstack/react-query'

import type { PluginConfigSnapshot } from '../types/plugin-config.types'
import { pluginConfigKeys } from './plugin-config.keys'

export function usePluginCurrentConfigQuery(
  pluginId: string,
  loadConfig: (pluginId: string) => Promise<PluginConfigSnapshot>,
) {
  return useQuery({
    enabled: pluginId.length > 0,
    queryFn: () => loadConfig(pluginId),
    queryKey: pluginConfigKeys.config(pluginId),
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  })
}

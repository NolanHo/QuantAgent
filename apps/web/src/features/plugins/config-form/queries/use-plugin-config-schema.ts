import { useQuery } from '@tanstack/react-query'

import type { PluginConfigSchemaSnapshot } from '../types/plugin-config.types'
import { pluginConfigKeys } from './plugin-config.keys'

export function usePluginConfigSchemaQuery(
  pluginId: string,
  loadSchema: (pluginId: string) => Promise<PluginConfigSchemaSnapshot>,
) {
  return useQuery({
    enabled: pluginId.length > 0,
    queryFn: () => loadSchema(pluginId),
    queryKey: pluginConfigKeys.schema(pluginId),
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  })
}

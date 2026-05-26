import { useMutation, useQuery } from '@tanstack/react-query'

import { useAuth } from '@/shared/auth'

import {
  fetchPluginConfigSchema,
  fetchPluginCurrentConfig,
  savePluginConfigDraft,
  validatePluginConfigDraft,
} from './api'
import { listDebugPluginFixtures } from './mock'
import type { PluginConfigSchemaSnapshot } from './types'

export function useDebugPluginRecords() {
  return useQuery({
    queryFn: async () => listDebugPluginFixtures(),
    queryKey: ['debug-plugin-records'],
    staleTime: Number.POSITIVE_INFINITY,
  })
}

export function usePluginConfigSchema(pluginId: string) {
  const { apiClient } = useAuth()

  return useQuery({
    enabled: pluginId.length > 0,
    queryFn: () => fetchPluginConfigSchema(apiClient, pluginId),
    queryKey: ['plugin-config-schema', pluginId],
  })
}

export function usePluginCurrentConfig(pluginId: string) {
  return useQuery({
    enabled: pluginId.length > 0,
    queryFn: () => fetchPluginCurrentConfig(pluginId),
    queryKey: ['plugin-current-config', pluginId],
  })
}

export function usePluginConfigValidation(schema: PluginConfigSchemaSnapshot | null) {
  return useMutation({
    mutationFn: (values: Record<string, string>) => {
      if (!schema) {
        throw new Error('Schema is required before validation.')
      }
      return validatePluginConfigDraft(schema, values)
    },
  })
}

export function usePluginConfigSave(schema: PluginConfigSchemaSnapshot | null) {
  return useMutation({
    mutationFn: (values: Record<string, string>) => {
      if (!schema) {
        throw new Error('Schema is required before save.')
      }
      return savePluginConfigDraft(schema, values)
    },
  })
}

import type { ApiClient } from '@/shared/api'

import {
  createSchemaSnapshotFromJsonSchema,
  getDebugPluginJsonSchema,
  loadDebugPluginConfig,
  loadDebugPluginSchema,
  saveDebugPluginConfig,
  validateDebugPluginConfig,
} from './mock'
import type {
  PluginConfigJsonSchema,
  PluginConfigSaveResult,
  PluginConfigSchemaSnapshot,
  PluginConfigSnapshot,
  PluginConfigValidationResult,
} from './types'

export async function fetchPluginConfigSchema(
  apiClient: ApiClient,
  pluginId: string,
): Promise<PluginConfigSchemaSnapshot> {
  try {
    const remoteSchema = await apiClient.get<PluginConfigJsonSchema>(
      `/plugins/${pluginId}/config-schema`,
      { dedupeKey: `plugin-config-schema:${pluginId}` },
    )
    return createSchemaSnapshotFromJsonSchema(pluginId, remoteSchema)
  } catch {
    const debugJsonSchema = getDebugPluginJsonSchema(pluginId)
    if (debugJsonSchema) {
      return createSchemaSnapshotFromJsonSchema(pluginId, debugJsonSchema, 'debug-mock')
    }

    return loadDebugPluginSchema(pluginId)
  }
}

export function fetchPluginCurrentConfig(pluginId: string): Promise<PluginConfigSnapshot> {
  return loadDebugPluginConfig(pluginId)
}

export function validatePluginConfigDraft(
  schema: PluginConfigSchemaSnapshot,
  values: Record<string, string>,
): Promise<PluginConfigValidationResult> {
  return validateDebugPluginConfig(schema, values)
}

export function savePluginConfigDraft(
  schema: PluginConfigSchemaSnapshot,
  values: Record<string, string>,
): Promise<PluginConfigSaveResult> {
  return saveDebugPluginConfig(schema, values)
}

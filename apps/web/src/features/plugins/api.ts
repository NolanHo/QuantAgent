import type { ApiClient } from '@/shared/api'

import {
  loadDebugPluginConfig,
  loadDebugPluginSchema,
  saveDebugPluginConfig,
  validateDebugPluginConfig,
} from './mock'
import type {
  PluginConfigSaveResult,
  PluginConfigSchemaSnapshot,
  PluginConfigSnapshot,
  PluginConfigValidationResult,
} from './types'

type RawJsonSchema = {
  title?: string
}

export async function fetchPluginConfigSchema(
  apiClient: ApiClient,
  pluginId: string,
): Promise<PluginConfigSchemaSnapshot> {
  // Current backend only guarantees the config-schema endpoint. The debug page
  // still validates the richer first-version boundary through controlled fixtures.
  try {
    const remoteSchema = await apiClient.get<RawJsonSchema>(
      `/plugins/${pluginId}/config-schema`,
      { dedupeKey: `plugin-config-schema:${pluginId}` },
    )

    const debugSchema = await loadDebugPluginSchema(pluginId)
    return {
      ...debugSchema,
      schemaSource: 'registry-api',
      schemaTitle: remoteSchema.title || debugSchema.schemaTitle,
    }
  } catch {
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

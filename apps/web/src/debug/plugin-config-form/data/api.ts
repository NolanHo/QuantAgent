import type {
  PluginConfigJsonSchema,
  PluginConfigSaveResult,
  PluginConfigSchemaSnapshot,
  PluginConfigSnapshot,
  PluginConfigValidationResult,
  PluginConfigValueMap,
} from '@/features/plugins/config-form'

import {
  createSchemaSnapshotFromJsonSchema,
  getDebugPluginJsonSchema,
  loadDebugPluginConfig,
  loadDebugPluginSchema,
} from './debug-fixtures'
import {
  saveDebugPluginConfig,
  validateDebugPluginConfig,
} from './mock'

export type PluginConfigSchemaLoader = (
  pluginId: string,
) => Promise<PluginConfigJsonSchema>

export async function fetchPluginConfigSchema(
  loadRemoteSchema: PluginConfigSchemaLoader,
  pluginId: string,
): Promise<PluginConfigSchemaSnapshot> {
  try {
    const remoteSchema = await loadRemoteSchema(pluginId)
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
  values: PluginConfigValueMap,
): Promise<PluginConfigValidationResult> {
  return validateDebugPluginConfig(schema, values)
}

export function savePluginConfigDraft(
  schema: PluginConfigSchemaSnapshot,
  values: PluginConfigValueMap,
): Promise<PluginConfigSaveResult> {
  return saveDebugPluginConfig(schema, values)
}

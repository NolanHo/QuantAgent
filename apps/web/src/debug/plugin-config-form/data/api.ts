import type {
  PluginConfigJsonSchema,
  PluginConfigSaveResult,
  PluginConfigSchemaSnapshot,
  PluginConfigSnapshot,
  PluginConfigValidationResult,
  PluginConfigValueMap,
} from '@/features/plugins/config-form'
import { parseConfigDraftPayload } from '@/features/plugins/config-form'
import type {
  PluginConfigApiContract,
  PluginConfigSnapshotResponse,
  PluginConfigUpdateResponse,
  PluginConfigValidateResponse,
} from '@/features/plugins'

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

export type PluginConfigRemoteAdapter = Pick<
  PluginConfigApiContract,
  'fetchConfig' | 'fetchConfigSchema' | 'updateConfig' | 'validateConfig'
>

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

function toPluginConfigSnapshot(response: PluginConfigSnapshotResponse): PluginConfigSnapshot {
  return {
    maskedPaths: response.masked_paths ?? [],
    values: response.values,
    versionTag: response.version_tag ?? response.updated_at ?? 'remote',
  }
}

function toValidationResult(response: PluginConfigValidateResponse): PluginConfigValidationResult {
  return {
    ok: response.ok ?? (response.issues?.length ?? 0) === 0,
    issues: response.issues ?? [],
  }
}

function toSaveResult(response: PluginConfigUpdateResponse): PluginConfigSaveResult {
  return {
    updatedAt: response.updated_at ?? new Date().toISOString(),
    versionTag: response.version_tag ?? response.updated_at ?? 'remote-saved',
  }
}

// 中文注释：debug 页优先验证正式 API 契约；接口缺失或未就绪时才降级到本地 mock。
export async function fetchPluginCurrentConfigWithFallback(
  remoteAdapter: PluginConfigRemoteAdapter,
  pluginId: string,
): Promise<PluginConfigSnapshot> {
  try {
    return toPluginConfigSnapshot(await remoteAdapter.fetchConfig(pluginId))
  } catch {
    return fetchPluginCurrentConfig(pluginId)
  }
}

export function validatePluginConfigDraft(
  schema: PluginConfigSchemaSnapshot,
  values: PluginConfigValueMap,
): Promise<PluginConfigValidationResult> {
  return validateDebugPluginConfig(schema, values)
}

export async function validatePluginConfigDraftWithFallback(
  remoteAdapter: PluginConfigRemoteAdapter,
  schema: PluginConfigSchemaSnapshot,
  values: PluginConfigValueMap,
): Promise<PluginConfigValidationResult> {
  try {
    return toValidationResult(
      await remoteAdapter.validateConfig(schema.pluginId, {
        values: JSON.parse(buildPreviewPayloadAsJson(schema, values)),
      }),
    )
  } catch {
    return validatePluginConfigDraft(schema, values)
  }
}

export function savePluginConfigDraft(
  schema: PluginConfigSchemaSnapshot,
  values: PluginConfigValueMap,
): Promise<PluginConfigSaveResult> {
  return saveDebugPluginConfig(schema, values)
}

export async function savePluginConfigDraftWithFallback(
  remoteAdapter: PluginConfigRemoteAdapter,
  schema: PluginConfigSchemaSnapshot,
  values: PluginConfigValueMap,
): Promise<PluginConfigSaveResult> {
  try {
    return toSaveResult(
      await remoteAdapter.updateConfig(schema.pluginId, {
        values: JSON.parse(buildPreviewPayloadAsJson(schema, values)),
      }),
    )
  } catch {
    return savePluginConfigDraft(schema, values)
  }
}

function buildPreviewPayloadAsJson(
  schema: PluginConfigSchemaSnapshot,
  values: PluginConfigValueMap,
): string {
  return JSON.stringify(parseConfigDraftPayload(schema, values))
}

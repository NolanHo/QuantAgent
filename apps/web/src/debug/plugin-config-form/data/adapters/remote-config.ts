import type {
  PluginConfigJsonSchema,
  PluginConfigSaveResult,
  PluginConfigSchemaSnapshot,
  PluginConfigSnapshot,
  PluginConfigValidationResult,
  PluginConfigValueMap,
} from '@/features/plugins/config-form'
import type {
  PluginConfigApiContract,
  PluginConfigSnapshotResponse,
  PluginConfigUpdateResponse,
  PluginConfigValidateResponse,
} from '@/features/plugins'
import { ApiError } from '@/shared/api'

import {
  createSchemaSnapshotFromJsonSchema,
  getDebugPluginJsonSchema,
  loadDebugPluginSchema,
} from '../fixtures/debug-fixtures'
import {
  fetchPluginCurrentConfig,
  savePluginConfigDraft,
  validatePluginConfigDraft,
} from './debug-config'
import { buildPreviewPayloadAsJson } from './preview-payload'

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
  } catch (error) {
    if (!canFallbackToDebugAdapter(error)) {
      throw error
    }

    const debugJsonSchema = getDebugPluginJsonSchema(pluginId)
    if (debugJsonSchema) {
      return createSchemaSnapshotFromJsonSchema(pluginId, debugJsonSchema, 'debug-mock')
    }

    return loadDebugPluginSchema(pluginId)
  }
}

function canFallbackToDebugAdapter(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    return false
  }

  // 只有后端明确表示插件配置接口尚不存在时才降级；鉴权、5xx 和网络错误必须继续可观测。
  return error.status === 404 || (error.status === undefined && error.code === 404)
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
  } catch (error) {
    if (!canFallbackToDebugAdapter(error)) {
      throw error
    }

    return fetchPluginCurrentConfig(pluginId)
  }
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
  } catch (error) {
    if (!canFallbackToDebugAdapter(error)) {
      throw error
    }

    return validatePluginConfigDraft(schema, values)
  }
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
  } catch (error) {
    if (!canFallbackToDebugAdapter(error)) {
      throw error
    }

    return savePluginConfigDraft(schema, values)
  }
}

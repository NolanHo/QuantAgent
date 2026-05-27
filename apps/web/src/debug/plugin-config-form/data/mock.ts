import { COMPLEX_PLUGIN_ID, MASK_TOKEN } from './debug-zod-schemas'
import {
  requireDebugPluginFixture,
} from './debug-fixtures'
import { validateDebugPayload } from './debug-zod-schemas'
import {
  maskSensitiveValues,
  parseConfigDraftPayload,
  PluginConfigJsonFieldParseError,
  validateSchemaFields,
} from '@/features/plugins/config-form'
import type {
  PluginConfigSaveResult,
  PluginConfigSchemaSnapshot,
  PluginConfigValidationResult,
  PluginConfigValueMap,
} from '@/features/plugins/config-form'
import { delay } from './utils'

export async function validateDebugPluginConfig(
  schema: PluginConfigSchemaSnapshot,
  values: PluginConfigValueMap,
): Promise<PluginConfigValidationResult> {
  await delay()

  const fieldValidation = validateSchemaFields(schema, values)
  if (!fieldValidation.ok || schema.schemaSource === 'registry-api') {
    return fieldValidation
  }

  try {
    return validateDebugPayload(
      schema,
      parseConfigDraftPayload(schema, values, {
        initializePayload: (payload) => {
          if (schema.pluginId === COMPLEX_PLUGIN_ID) {
            payload.auth = { type: 'oauth2' }
          }
        },
      }),
    )
  } catch (error) {
    if (error instanceof PluginConfigJsonFieldParseError) {
      return {
        ok: false,
        issues: [{ path: error.path, message: '需要提供合法的 JSON 文本。' }],
      }
    }
    throw error
  }
}

export async function saveDebugPluginConfig(
  schema: PluginConfigSchemaSnapshot,
  values: PluginConfigValueMap,
): Promise<PluginConfigSaveResult> {
  await delay(220)

  const validation = await validateDebugPluginConfig(schema, values)
  if (!validation.ok) {
    throw new Error(`配置校验失败：${validation.issues[0]?.message ?? '请先修正表单。'}`)
  }

  if ((values.environment ?? '').trim().toLowerCase() === 'production') {
    throw new Error('调试页 mock save 拒绝直接把环境切换为 production。')
  }

  if (values['auth.clientId']?.trim() === 'simulate-save-failure') {
    throw new Error('已按调试输入触发保存失败分支。')
  }

  const fixture = requireDebugPluginFixture(schema.pluginId)

  fixture.config = {
    maskedPaths: fixture.config.maskedPaths,
    versionTag: `${fixture.config.versionTag}-saved`,
    values: maskSensitiveValues(values, schema.fields, fixture.config.maskedPaths, MASK_TOKEN),
  }

  return {
    updatedAt: new Date().toISOString(),
    versionTag: fixture.config.versionTag,
  }
}

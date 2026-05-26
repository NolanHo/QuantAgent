import { COMPLEX_PLUGIN_ID, MASK_TOKEN } from './debug-zod-schemas'
import {
  complexConfigSourceAtPath,
  complexFieldMetadata,
  debugFixtures,
  debugPluginRecords,
  simpleConfigSourceAtPath,
  simpleFieldMetadata,
} from './debug-fixtures'
import { validateDebugPayload } from './debug-zod-schemas'
import {
  flattenJsonSchema,
  isPlainObject,
} from '@/features/plugins/config-form'
import type {
  PluginConfigFieldDefinition,
  PluginConfigJsonSchema,
  PluginConfigSaveResult,
  PluginConfigSchemaSnapshot,
  PluginConfigSnapshot,
  PluginConfigValidationIssue,
  PluginConfigValidationResult,
} from '@/features/plugins/config-form'
import type {
  PluginConfigDebugFixture,
  PluginRecord,
} from '../model'

class JsonFieldParseError extends Error {
  readonly path: string

  constructor(path: string) {
    super('Invalid JSON field value.')
    this.path = path
  }
}

function delay(ms = 120): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms)
  })
}

function setPathValue(target: Record<string, unknown>, path: string[], value: unknown) {
  let current: Record<string, unknown> = target

  for (const segment of path.slice(0, -1)) {
    const next = current[segment]
    if (!isPlainObject(next)) {
      current[segment] = {}
    }
    current = current[segment] as Record<string, unknown>
  }

  current[path.at(-1) ?? ''] = value
}

function parseArrayInput(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function isValidFormat(value: string, format: string): boolean {
  if (format === 'uuid') {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  }

  if (format === 'uri' || format === 'url') {
    try {
      new URL(value)
      return true
    } catch {
      return false
    }
  }

  if (format === 'date-time') {
    return !Number.isNaN(Date.parse(value))
  }

  if (format === 'ipv4') {
    return /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(value)
  }

  return true
}

function formatIssueMessage(definition: PluginConfigFieldDefinition): string {
  if (definition.path === 'pluginId') {
    return '插件 ID 必须是 UUID 形式。'
  }

  if (definition.path === 'auth.tokenEndpoint') {
    return 'Token 地址必须是合法 URL。'
  }

  return '格式不符合要求。'
}

function parseScalarValue(definition: PluginConfigFieldDefinition, rawValue: string): unknown {
  switch (definition.type) {
    case 'boolean':
      return rawValue === 'true'
    case 'integer':
    case 'number':
      return Number(rawValue)
    case 'array':
      if (definition.support !== 'degraded') {
        return parseArrayInput(rawValue)
      }
      try {
        return JSON.parse(rawValue)
      } catch {
        throw new JsonFieldParseError(definition.path)
      }
    case 'record':
    case 'union':
      try {
        return JSON.parse(rawValue)
      } catch {
        throw new JsonFieldParseError(definition.path)
      }
    default:
      return rawValue
  }
}

function parseFormValues(
  schema: PluginConfigSchemaSnapshot,
  values: Record<string, string>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  if (schema.pluginId === COMPLEX_PLUGIN_ID) {
    setPathValue(payload, ['auth', 'type'], 'oauth2')
  }

  for (const definition of schema.fields) {
    const rawValue = values[definition.path] ?? ''
    const trimmedValue = rawValue.trim()

    if (trimmedValue.length === 0) {
      continue
    }

    setPathValue(payload, definition.path.split('.'), parseScalarValue(definition, trimmedValue))
  }

  return payload
}

function metadataForPlugin(pluginId: string) {
  return pluginId === COMPLEX_PLUGIN_ID ? complexFieldMetadata : simpleFieldMetadata
}

function sampleReaderForPlugin(pluginId: string) {
  return pluginId === COMPLEX_PLUGIN_ID ? complexConfigSourceAtPath : simpleConfigSourceAtPath
}

export function getDebugPluginFixture(pluginId: string): PluginConfigDebugFixture | null {
  return debugFixtures[pluginId] ?? null
}

export function listDebugPluginFixtures(): PluginRecord[] {
  return debugPluginRecords
}

export async function loadDebugPluginSchema(
  pluginId: string,
): Promise<PluginConfigSchemaSnapshot> {
  await delay()
  const fixture = getDebugPluginFixture(pluginId)
  if (!fixture) {
    throw new Error(`Unknown debug plugin fixture: ${pluginId}`)
  }

  return fixture.schema
}

export function getDebugPluginJsonSchema(pluginId: string): PluginConfigJsonSchema | null {
  return getDebugPluginFixture(pluginId)?.jsonSchema ?? null
}

export function createSchemaSnapshotFromJsonSchema(
  pluginId: string,
  jsonSchema: PluginConfigJsonSchema,
  schemaSource: PluginConfigSchemaSnapshot['schemaSource'] = 'registry-api',
): PluginConfigSchemaSnapshot {
  const fixture = getDebugPluginFixture(pluginId)

  if (!fixture) {
    throw new Error(`Unknown debug plugin fixture: ${pluginId}`)
  }

  const baseSchema = fixture.schema

  return {
    ...baseSchema,
    schemaSource,
    schemaTitle: jsonSchema.title ?? baseSchema.schemaTitle,
    fields: flattenJsonSchema(jsonSchema, {
      metadataByPath: metadataForPlugin(pluginId),
      sampleAtPath: sampleReaderForPlugin(pluginId),
    }),
  }
}

function validateFieldDefinitions(
  schema: PluginConfigSchemaSnapshot,
  values: Record<string, string>,
): PluginConfigValidationResult {
  const issues: PluginConfigValidationIssue[] = []

  for (const definition of schema.fields) {
    const rawValue = values[definition.path] ?? ''
    const trimmedValue = rawValue.trim()

    if (definition.required && trimmedValue.length === 0) {
      issues.push({ path: definition.path, message: '该字段为必填项。' })
      continue
    }

    if (trimmedValue.length === 0) {
      continue
    }

    const constraints = definition.constraints

    if (constraints?.minLength !== undefined && trimmedValue.length < constraints.minLength) {
      issues.push({ path: definition.path, message: `至少需要 ${constraints.minLength} 个字符。` })
    }

    if (constraints?.maxLength !== undefined && trimmedValue.length > constraints.maxLength) {
      issues.push({ path: definition.path, message: `最多允许 ${constraints.maxLength} 个字符。` })
    }

    if (constraints?.pattern) {
      try {
        if (!new RegExp(constraints.pattern).test(trimmedValue)) {
          issues.push({ path: definition.path, message: formatIssueMessage(definition) })
        }
      } catch {
        issues.push({ path: definition.path, message: '字段格式规则无效。' })
      }
    }

    if (constraints?.format && !isValidFormat(trimmedValue, constraints.format)) {
      issues.push({ path: definition.path, message: formatIssueMessage(definition) })
    }

    if (definition.enumValues && !definition.enumValues.includes(trimmedValue)) {
      issues.push({
        path: definition.path,
        message: `可选值为：${definition.enumValues.join(' / ')}`,
      })
    }

    if (definition.type === 'boolean' && trimmedValue !== 'true' && trimmedValue !== 'false') {
      issues.push({ path: definition.path, message: '布尔字段只能填写 true 或 false。' })
    }

    if (
      (definition.type === 'integer' || definition.type === 'number') &&
      Number.isNaN(Number(trimmedValue))
    ) {
      issues.push({ path: definition.path, message: '该字段需要数字格式。' })
      continue
    }

    if (definition.type === 'integer' && !Number.isInteger(Number(trimmedValue))) {
      issues.push({ path: definition.path, message: '该字段需要整数格式。' })
    }

    const numericValue = Number(trimmedValue)
    if ((definition.type === 'integer' || definition.type === 'number') && !Number.isNaN(numericValue)) {
      if (constraints?.minimum !== undefined && numericValue < constraints.minimum) {
        issues.push({ path: definition.path, message: `数值不能小于 ${constraints.minimum}。` })
      }
      if (constraints?.exclusiveMinimum !== undefined && numericValue <= constraints.exclusiveMinimum) {
        issues.push({ path: definition.path, message: `数值必须大于 ${constraints.exclusiveMinimum}。` })
      }
      if (constraints?.maximum !== undefined && numericValue > constraints.maximum) {
        issues.push({ path: definition.path, message: `数值不能大于 ${constraints.maximum}。` })
      }
      if (constraints?.exclusiveMaximum !== undefined && numericValue >= constraints.exclusiveMaximum) {
        issues.push({ path: definition.path, message: `数值必须小于 ${constraints.exclusiveMaximum}。` })
      }
    }

    if (definition.type === 'array' && definition.support === 'supported') {
      const items = parseArrayInput(trimmedValue)
      if (constraints?.minItems !== undefined && items.length < constraints.minItems) {
        issues.push({ path: definition.path, message: `至少需要 ${constraints.minItems} 项。` })
      }
      if (constraints?.maxItems !== undefined && items.length > constraints.maxItems) {
        issues.push({ path: definition.path, message: `最多允许 ${constraints.maxItems} 项。` })
      }
    }

    if (
      definition.type === 'record' ||
      definition.type === 'union' ||
      (definition.type === 'array' && definition.support === 'degraded')
    ) {
      try {
        const parsedValue = JSON.parse(trimmedValue)
        if (definition.type === 'array' && Array.isArray(parsedValue)) {
          if (constraints?.minItems !== undefined && parsedValue.length < constraints.minItems) {
            issues.push({ path: definition.path, message: `至少需要 ${constraints.minItems} 项。` })
          }
          if (constraints?.maxItems !== undefined && parsedValue.length > constraints.maxItems) {
            issues.push({ path: definition.path, message: `最多允许 ${constraints.maxItems} 项。` })
          }
        }
      } catch {
        issues.push({ path: definition.path, message: '需要提供合法的 JSON 文本。' })
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
  }
}

export async function loadDebugPluginConfig(
  pluginId: string,
): Promise<PluginConfigSnapshot> {
  await delay()
  const fixture = getDebugPluginFixture(pluginId)
  if (!fixture) {
    throw new Error(`Unknown debug plugin fixture: ${pluginId}`)
  }

  return fixture.config
}

export async function validateDebugPluginConfig(
  schema: PluginConfigSchemaSnapshot,
  values: Record<string, string>,
): Promise<PluginConfigValidationResult> {
  await delay()

  const fieldValidation = validateFieldDefinitions(schema, values)
  if (!fieldValidation.ok || schema.schemaSource === 'registry-api') {
    return fieldValidation
  }

  try {
    return validateDebugPayload(schema, parseFormValues(schema, values))
  } catch (error) {
    if (error instanceof JsonFieldParseError) {
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
  values: Record<string, string>,
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

  const fixture = getDebugPluginFixture(schema.pluginId)
  if (!fixture) {
    throw new Error(`Unknown debug plugin fixture: ${schema.pluginId}`)
  }

  const nextValues = { ...values }
  if (
    (nextValues['auth.clientSecret'] ?? '').trim().length > 0 &&
    nextValues['auth.clientSecret'] !== MASK_TOKEN
  ) {
    nextValues['auth.clientSecret'] = MASK_TOKEN
  }

  fixture.config = {
    maskedPaths: fixture.config.maskedPaths,
    versionTag: `${fixture.config.versionTag}-saved`,
    values: nextValues,
  }

  return {
    updatedAt: new Date().toISOString(),
    versionTag: fixture.config.versionTag,
  }
}

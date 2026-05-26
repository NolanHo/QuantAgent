import { COMPLEX_PLUGIN_ID, MASK_TOKEN } from './debug-zod-schemas'
import {
  complexConfigSourceAtPath,
  complexFieldMetadata,
  debugFixtures,
  debugPluginRecords,
  simpleConfigSourceAtPath,
  simpleFieldMetadata,
} from './debug-fixtures'
import { flattenJsonSchema, isPlainObject } from './schema-json'
import { validateDebugPayload } from './debug-zod-schemas'
import type {
  PluginConfigDebugFixture,
  PluginConfigFieldDefinition,
  PluginConfigJsonSchema,
  PluginConfigSaveResult,
  PluginConfigSchemaSnapshot,
  PluginConfigSnapshot,
  PluginConfigValidationResult,
  PluginRecord,
} from './types'

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

function parseScalarValue(definition: PluginConfigFieldDefinition, rawValue: string): unknown {
  switch (definition.type) {
    case 'boolean':
      return rawValue === 'true'
    case 'integer':
    case 'number':
      return Number(rawValue)
    case 'array':
      return definition.support === 'degraded' ? JSON.parse(rawValue) : parseArrayInput(rawValue)
    case 'record':
    case 'union':
      return JSON.parse(rawValue)
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
): PluginConfigSchemaSnapshot {
  const fixture = getDebugPluginFixture(pluginId)

  if (!fixture) {
    throw new Error(`Unknown debug plugin fixture: ${pluginId}`)
  }

  const baseSchema = fixture.schema

  return {
    ...baseSchema,
    schemaSource: 'registry-api',
    schemaTitle: jsonSchema.title ?? baseSchema.schemaTitle,
    fields: flattenJsonSchema(jsonSchema, {
      metadataByPath: metadataForPlugin(pluginId),
      sampleAtPath: sampleReaderForPlugin(pluginId),
    }),
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

  return validateDebugPayload(schema, parseFormValues(schema, values))
}

export async function saveDebugPluginConfig(
  schema: PluginConfigSchemaSnapshot,
  values: Record<string, string>,
): Promise<PluginConfigSaveResult> {
  await delay(220)

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

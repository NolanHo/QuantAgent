import type {
  PluginConfigFieldDefinition,
  PluginConfigSchemaSnapshot,
  PluginConfigValidationIssue,
  PluginConfigValidationResult,
  PluginConfigValueMap,
} from '../types'

export function normalizeInitialValues(
  schemaFields: PluginConfigFieldDefinition[],
  values: PluginConfigValueMap,
): PluginConfigValueMap {
  const nextValues: PluginConfigValueMap = { ...values }

  for (const definition of schemaFields) {
    if (nextValues[definition.path] !== undefined) {
      nextValues[definition.path] = normalizeExistingFieldValue(
        definition,
        nextValues[definition.path],
      )
      continue
    }

    if (definition.constValue !== undefined) {
      nextValues[definition.path] = serializeFieldValue(definition, definition.constValue)
      continue
    }

    if (definition.defaultValue === undefined) {
      nextValues[definition.path] = ''
      continue
    }

    nextValues[definition.path] = serializeFieldValue(definition, definition.defaultValue)
  }

  return nextValues
}

function serializeJsonValue(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function normalizeExistingFieldValue(
  definition: PluginConfigFieldDefinition,
  value: string,
): string {
  if (
    definition.type !== 'record' &&
    definition.type !== 'union' &&
    !(definition.type === 'array' && definition.support === 'degraded')
  ) {
    return value
  }

  try {
    return serializeJsonValue(JSON.parse(value))
  } catch {
    return value
  }
}

function serializeFieldValue(
  definition: PluginConfigFieldDefinition,
  value: unknown,
): string {
  if (value === undefined || value === null) {
    return ''
  }

  if (definition.type === 'boolean') {
    return value ? 'true' : 'false'
  }

  if (definition.type === 'integer' || definition.type === 'number' || definition.type === 'string') {
    return String(value)
  }

  if (definition.type === 'array') {
    if (definition.support === 'degraded') {
      return serializeJsonValue(value)
    }

    return Array.isArray(value) ? value.map((entry) => String(entry)).join(',') : String(value)
  }

  return typeof value === 'string' ? value : serializeJsonValue(value)
}

export function issueMap(issues: PluginConfigValidationIssue[]): Map<string, string> {
  return new Map(issues.map((issue) => [issue.path, issue.message]))
}

export function updateValueMap(
  values: PluginConfigValueMap,
  path: string,
  nextValue: string,
): PluginConfigValueMap {
  return {
    ...values,
    [path]: nextValue,
  }
}

export function splitArrayPreview(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export function splitArrayDraftItems(value: string): string[] {
  if (value.length === 0) {
    return ['']
  }

  return value.split(',').map((entry) => entry.trim())
}

export function joinArrayDraftValue(items: string[]): string {
  return items.map((entry) => entry.trim()).join(',')
}

export class PluginConfigJsonFieldParseError extends Error {
  readonly path: string

  constructor(path: string, message = 'Invalid JSON field value.') {
    super(message)
    this.path = path
  }
}

function setNestedValue(target: Record<string, unknown>, path: string[], value: unknown) {
  let current: Record<string, unknown> = target

  for (const segment of path.slice(0, -1)) {
    const next = current[segment]
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      current[segment] = {}
    }
    current = current[segment] as Record<string, unknown>
  }

  current[path.at(-1) ?? ''] = value
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

function parseDraftFieldValue(
  definition: PluginConfigFieldDefinition,
  rawValue: string,
): unknown {
  switch (definition.type) {
    case 'boolean':
      return rawValue === 'true'
    case 'integer':
    case 'number': {
      const numericValue = Number(rawValue)
      if (Number.isNaN(numericValue)) {
        throw new PluginConfigJsonFieldParseError(definition.path, 'Invalid numeric field value.')
      }
      return numericValue
    }
    case 'array':
      if (definition.support !== 'degraded') {
        return splitArrayPreview(rawValue)
      }
      try {
        return JSON.parse(rawValue)
      } catch {
        throw new PluginConfigJsonFieldParseError(definition.path)
      }
    case 'record':
    case 'union':
      try {
        return JSON.parse(rawValue)
      } catch {
        throw new PluginConfigJsonFieldParseError(definition.path)
      }
    default:
      return rawValue
  }
}

function validateRecordKeys(
  definition: PluginConfigFieldDefinition,
  parsedValue: unknown,
): string | null {
  if (!definition.propertyKeyPattern || !parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
    return null
  }

  try {
    const pattern = new RegExp(definition.propertyKeyPattern)
    const invalidKey = Object.keys(parsedValue).find((key) => !pattern.test(key))
    if (!invalidKey) {
      return null
    }

    return `存在不符合 key 规则的字段：${invalidKey}`
  } catch {
    return '字段 key 规则无效。'
  }
}

function shouldTreatEmptyAsMissing(definition: PluginConfigFieldDefinition): boolean {
  if (definition.readOnly || definition.constValue !== undefined) {
    return false
  }

  return definition.required
}

function defaultFormatIssueMessage(definition: PluginConfigFieldDefinition): string {
  if (definition.path === 'pluginId') {
    return '插件 ID 必须是 UUID 形式。'
  }

  if (definition.path === 'auth.clientSecret') {
    return '敏感字段必须保持掩码或输入不少于 16 位的新值。'
  }

  if (definition.path === 'auth.tokenEndpoint') {
    return 'Token 地址必须是合法 URL。'
  }

  return '格式不符合要求。'
}

export function validateSchemaFields(
  schema: PluginConfigSchemaSnapshot,
  values: PluginConfigValueMap,
  options: {
    formatIssueMessage?: (definition: PluginConfigFieldDefinition) => string
  } = {},
): PluginConfigValidationResult {
  const issues: PluginConfigValidationIssue[] = []
  const formatIssueMessage = options.formatIssueMessage ?? defaultFormatIssueMessage

  for (const definition of schema.fields) {
    const rawValue = values[definition.path] ?? ''
    const trimmedValue = rawValue.trim()

    if (
      definition.required &&
      !definition.readOnly &&
      definition.constValue === undefined &&
      trimmedValue.length === 0
    ) {
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
      const items = splitArrayPreview(trimmedValue)
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
        if (definition.type === 'record') {
          const recordKeyIssue = validateRecordKeys(definition, parsedValue)
          if (recordKeyIssue) {
            issues.push({ path: definition.path, message: recordKeyIssue })
          }
        }
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

export function parseConfigDraftPayload(
  schema: PluginConfigSchemaSnapshot,
  values: PluginConfigValueMap,
  options: {
    initializePayload?: (payload: Record<string, unknown>) => void
  } = {},
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  options.initializePayload?.(payload)

  for (const definition of schema.fields) {
    const rawValue = values[definition.path] ?? ''
    const trimmedValue = rawValue.trim()

    if (trimmedValue.length === 0) {
      if (shouldTreatEmptyAsMissing(definition)) {
        throw new PluginConfigJsonFieldParseError(definition.path, 'Missing required field value.')
      }
      if (definition.constValue !== undefined) {
        setNestedValue(payload, definition.path.split('.'), definition.constValue)
      } else if (definition.defaultValue !== undefined) {
        setNestedValue(payload, definition.path.split('.'), definition.defaultValue)
      }
      continue
    }

    setNestedValue(payload, definition.path.split('.'), parseDraftFieldValue(definition, trimmedValue))
  }

  return payload
}

export function maskSensitiveValues(
  values: PluginConfigValueMap,
  schemaFields: PluginConfigFieldDefinition[],
  maskedPaths: string[],
  maskToken: string,
): PluginConfigValueMap {
  const nextValues = { ...values }
  const sensitivePaths = new Set<string>([
    ...maskedPaths,
    ...schemaFields.filter((field) => field.sensitive).map((field) => field.path),
  ])

  for (const path of sensitivePaths) {
    const rawValue = (nextValues[path] ?? '').trim()
    if (rawValue.length > 0 && nextValues[path] !== maskToken) {
      nextValues[path] = maskToken
    }
  }

  return nextValues
}

export function fieldConstraintCopies(definition: PluginConfigFieldDefinition): string[] {
  const constraints = definition.constraints
  const copies: string[] = []

  if (!constraints) {
    return copies
  }

  if (constraints.minLength !== undefined) {
    copies.push(`至少 ${constraints.minLength} 个字符`)
  }
  if (constraints.maxLength !== undefined) {
    copies.push(`最多 ${constraints.maxLength} 个字符`)
  }
  if (constraints.minItems !== undefined) {
    copies.push(`至少 ${constraints.minItems} 项`)
  }
  if (constraints.maxItems !== undefined) {
    copies.push(`最多 ${constraints.maxItems} 项`)
  }
  if (constraints.minimum !== undefined) {
    copies.push(`不小于 ${constraints.minimum}`)
  }
  if (constraints.exclusiveMinimum !== undefined) {
    copies.push(`大于 ${constraints.exclusiveMinimum}`)
  }
  if (constraints.maximum !== undefined) {
    copies.push(`不大于 ${constraints.maximum}`)
  }
  if (constraints.exclusiveMaximum !== undefined) {
    copies.push(`小于 ${constraints.exclusiveMaximum}`)
  }
  if (constraints.format === 'uuid') {
    copies.push('UUID 格式')
  } else if (constraints.format === 'uri' || constraints.format === 'url') {
    copies.push('URL 格式')
  } else if (constraints.format === 'date-time') {
    copies.push('日期时间格式')
  } else if (constraints.format === 'ipv4') {
    copies.push('IPv4 格式')
  } else if (constraints.format) {
    copies.push(`${constraints.format} 格式`)
  }
  if (constraints.pattern) {
    copies.push('需匹配指定格式')
  }

  return copies
}

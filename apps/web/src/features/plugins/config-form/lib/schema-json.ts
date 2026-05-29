import type { PluginConfigFieldDefinition, PluginConfigJsonSchema } from '../types'

const descriptionPattern = /^(?<label>[^|]+?)(?:\|title:(?<title>[^;|]+))?(?:;desc:(?<desc>.+))?$/

export type FieldMetadata = {
  choiceOptions?: string[]
  constraints?: PluginConfigFieldDefinition['constraints']
  description?: string
  label?: string
  placeholder?: string
  readOnly?: boolean
  sensitive?: boolean
  support?: PluginConfigFieldDefinition['support']
  supportNote?: string
}

type JsonSchemaContext = {
  metadataByPath: Map<string, FieldMetadata>
  sampleAtPath: (path: string) => unknown
}

const SYSTEM_MANAGED_FIELD_PATHS = new Set(['pluginId', 'version'])

function parseDescribeMetadata(description: string | undefined): FieldMetadata {
  if (!description) {
    return {}
  }

  const match = description.match(descriptionPattern)
  if (!match?.groups) {
    return { description }
  }

  return {
    label: match.groups.title?.trim() || match.groups.label.trim(),
    description: match.groups.desc?.trim() || match.groups.label.trim(),
  }
}

function createField(
  definition: Omit<PluginConfigFieldDefinition, 'support'> & {
    support?: PluginConfigFieldDefinition['support']
  },
): PluginConfigFieldDefinition {
  return {
    ...definition,
    support: definition.support ?? 'supported',
  }
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toPath(parentPath: string, segment: string): string {
  return parentPath ? `${parentPath}.${segment}` : segment
}

function makeExamples(
  value: unknown,
  fieldType: PluginConfigFieldDefinition['type'],
): string[] | undefined {
  if (value === undefined) {
    return undefined
  }

  if (fieldType === 'array' || fieldType === 'record' || fieldType === 'union' || isPlainObject(value)) {
    return [JSON.stringify(value)]
  }

  return [String(value)]
}

function inferFieldTypeFromJsonSchema(
  schema: PluginConfigJsonSchema,
): PluginConfigFieldDefinition['type'] {
  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    return 'union'
  }

  if (schema.type === 'array') {
    return 'array'
  }

  if (schema.type === 'boolean') {
    return 'boolean'
  }

  if (schema.type === 'integer') {
    return 'integer'
  }

  if (schema.type === 'number') {
    return 'number'
  }

  if (schema.type === 'object') {
    if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      return 'record'
    }
    return 'object'
  }

  return 'string'
}

function inferFieldTypeFromConstValue(
  value: unknown,
): PluginConfigFieldDefinition['type'] {
  if (Array.isArray(value)) {
    return 'array'
  }

  if (typeof value === 'boolean') {
    return 'boolean'
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'number'
  }

  if (isPlainObject(value)) {
    return 'object'
  }

  return 'string'
}

function inferReadOnly(path: string, schema: PluginConfigJsonSchema, metadata: FieldMetadata): boolean {
  if (metadata.readOnly !== undefined) {
    return metadata.readOnly
  }

  if (schema.const !== undefined) {
    return true
  }

  return SYSTEM_MANAGED_FIELD_PATHS.has(path)
}

function inferReadOnlySupportNote(
  path: string,
  schema: PluginConfigJsonSchema,
  metadata: FieldMetadata,
): string | undefined {
  if (metadata.supportNote) {
    return metadata.supportNote
  }

  if (schema.const !== undefined) {
    return '该字段由插件实现固定，不在此处编辑。'
  }

  if (path === 'pluginId') {
    return '系统生成的插件实例标识，不允许手动修改。'
  }

  if (path === 'version') {
    return '版本号来自插件发布产物，不在此处编辑。'
  }

  return undefined
}

function schemaSupportsDegradedMode(schema: PluginConfigJsonSchema): boolean {
  const fieldType = inferFieldTypeFromJsonSchema(schema)

  return (
    fieldType === 'record' ||
    fieldType === 'union' ||
    (fieldType === 'array' && schema.items?.type === 'object')
  )
}

function unionOptionsFromJsonSchema(schema: PluginConfigJsonSchema): string[] | undefined {
  if (!Array.isArray(schema.oneOf)) {
    return undefined
  }

  const options = schema.oneOf
    .map((option) => option.properties?.protocol?.const)
    .filter((value): value is string => typeof value === 'string')

  return options.length > 0 ? options : undefined
}

function constraintsFromJsonSchema(
  schema: PluginConfigJsonSchema,
  metadata?: FieldMetadata,
): PluginConfigFieldDefinition['constraints'] {
  const constraints = {
    exclusiveMaximum: metadata?.constraints?.exclusiveMaximum ?? schema.exclusiveMaximum,
    exclusiveMinimum: metadata?.constraints?.exclusiveMinimum ?? schema.exclusiveMinimum,
    format: metadata?.constraints?.format ?? schema.format,
    maximum: metadata?.constraints?.maximum ?? schema.maximum,
    maxItems: metadata?.constraints?.maxItems ?? schema.maxItems,
    maxLength: metadata?.constraints?.maxLength ?? schema.maxLength,
    minimum: metadata?.constraints?.minimum ?? schema.minimum,
    minItems: metadata?.constraints?.minItems ?? schema.minItems,
    minLength: metadata?.constraints?.minLength ?? schema.minLength,
    pattern: metadata?.constraints?.pattern ?? schema.pattern,
  }
  const hasConstraints = Object.values(constraints).some((value) => value !== undefined)

  return hasConstraints ? constraints : undefined
}

function propertyKeyPatternFromJsonSchema(schema: PluginConfigJsonSchema): string | undefined {
  if (!schema.propertyNames || Array.isArray(schema.propertyNames.type)) {
    return undefined
  }

  return schema.propertyNames.pattern
}

function recordValueShapeFromJsonSchema(schema: PluginConfigJsonSchema): string | undefined {
  if (!schema.additionalProperties || typeof schema.additionalProperties !== 'object') {
    return 'Record<string, any>'
  }

  const valueSchema = schema.additionalProperties

  if (Array.isArray(valueSchema.oneOf) && valueSchema.oneOf.length > 0) {
    return 'Record<string, union>'
  }

  if (valueSchema.type) {
    if (valueSchema.type === 'object') {
      return 'Record<string, object>'
    }
    return `Record<string, ${valueSchema.type}>`
  }

  return 'Record<string, any>'
}

export function flattenJsonSchema(
  schema: PluginConfigJsonSchema,
  context: JsonSchemaContext,
  parentPath = '',
): PluginConfigFieldDefinition[] {
  const fields: PluginConfigFieldDefinition[] = []
  const properties = schema.properties ?? {}
  const required = new Set(schema.required ?? [])

  for (const [key, childSchema] of Object.entries(properties)) {
    const path = toPath(parentPath, key)
    const metadata = {
      ...parseDescribeMetadata(childSchema.description),
      ...context.metadataByPath.get(path),
    }
    const fieldType =
      childSchema.const !== undefined
        ? inferFieldTypeFromConstValue(childSchema.const)
        : inferFieldTypeFromJsonSchema(childSchema)
    const sample = childSchema.const ?? context.sampleAtPath(path)
    const examples =
      metadata.placeholder !== undefined
        ? [metadata.placeholder]
        : makeExamples(sample, fieldType)
    const readOnly = inferReadOnly(path, childSchema, metadata)
    const readOnlySupportNote = inferReadOnlySupportNote(path, childSchema, metadata)

    if (fieldType === 'object') {
      fields.push(...flattenJsonSchema(childSchema, context, path))
      continue
    }

    fields.push(
      createField({
        path,
        key,
        label: metadata.label ?? key,
        constValue: childSchema.const,
        description: metadata.description,
        type: fieldType,
        required: required.has(key),
        readOnly,
        sensitive: metadata.sensitive,
        placeholder: metadata.placeholder,
        propertyKeyPattern: fieldType === 'record' ? propertyKeyPatternFromJsonSchema(childSchema) : undefined,
        defaultValue: childSchema.default,
        enumValues: Array.isArray(childSchema.enum)
          ? childSchema.enum.filter((value): value is string => typeof value === 'string')
          : undefined,
        choiceOptions: metadata.choiceOptions,
        recordValueShape:
          fieldType === 'record' ? recordValueShapeFromJsonSchema(childSchema) : undefined,
        unionOptions: unionOptionsFromJsonSchema(childSchema),
        examples,
        constraints: constraintsFromJsonSchema(childSchema, metadata),
        support: metadata.support ?? (schemaSupportsDegradedMode(childSchema) ? 'degraded' : undefined),
        supportNote:
          readOnlySupportNote ??
          (fieldType === 'record'
            ? '首版以 JSON 文本区域编辑 record，并展示 key pattern 要求。'
            : fieldType === 'union'
              ? '首版展示 discriminated union 摘要，不提供分支级专用子表单。'
              : fieldType === 'array' && childSchema.items?.type === 'object'
                ? '首版以 JSON 文本区域编辑复杂对象数组。'
                : undefined),
      }),
    )
  }

  return fields
}

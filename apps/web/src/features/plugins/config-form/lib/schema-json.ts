import type { PluginConfigFieldDefinition, PluginConfigJsonSchema } from '../types'

const descriptionPattern = /^(?<label>[^|]+?)(?:\|title:(?<title>[^;|]+))?(?:;desc:(?<desc>.+))?$/

export type FieldMetadata = {
  description?: string
  label?: string
  placeholder?: string
  sensitive?: boolean
  support?: PluginConfigFieldDefinition['support']
  supportNote?: string
}

type JsonSchemaContext = {
  metadataByPath: Map<string, FieldMetadata>
  sampleAtPath: (path: string) => unknown
}

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
): PluginConfigFieldDefinition['constraints'] {
  const constraints = {
    exclusiveMaximum: schema.exclusiveMaximum,
    exclusiveMinimum: schema.exclusiveMinimum,
    format: schema.format,
    maximum: schema.maximum,
    maxItems: schema.maxItems,
    maxLength: schema.maxLength,
    minimum: schema.minimum,
    minItems: schema.minItems,
    minLength: schema.minLength,
    pattern: schema.pattern,
  }
  const hasConstraints = Object.values(constraints).some((value) => value !== undefined)

  return hasConstraints ? constraints : undefined
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
    const fieldType = inferFieldTypeFromJsonSchema(childSchema)
    const sample = context.sampleAtPath(path)
    const examples =
      metadata.placeholder !== undefined
        ? [metadata.placeholder]
        : makeExamples(sample, fieldType)

    if (childSchema.const !== undefined) {
      continue
    }

    if (fieldType === 'object') {
      fields.push(...flattenJsonSchema(childSchema, context, path))
      continue
    }

    fields.push(
      createField({
        path,
        key,
        label: metadata.label ?? key,
        description: metadata.description,
        type: fieldType,
        required: required.has(key),
        sensitive: metadata.sensitive,
        placeholder: metadata.placeholder,
        defaultValue: childSchema.default,
        enumValues: Array.isArray(childSchema.enum)
          ? childSchema.enum.filter((value): value is string => typeof value === 'string')
          : undefined,
        recordValueShape:
          fieldType === 'record' ? '{ targetCluster, weight, timeoutMs }' : undefined,
        unionOptions: unionOptionsFromJsonSchema(childSchema),
        examples,
        constraints: constraintsFromJsonSchema(childSchema),
        support: metadata.support ?? (schemaSupportsDegradedMode(childSchema) ? 'degraded' : undefined),
        supportNote:
          metadata.supportNote ??
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

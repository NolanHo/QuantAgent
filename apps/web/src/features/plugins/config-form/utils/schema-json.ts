import type { PluginConfigFieldDefinition, PluginConfigJsonSchema } from '../types/plugin-config.types'

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
    return { description: localizeSchemaCopy(description) }
  }

  return {
    label: localizeFieldLabel('', match.groups.title?.trim() || match.groups.label.trim()),
    description: localizeSchemaCopy(match.groups.desc?.trim() || match.groups.label.trim()),
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

function inferSensitive(path: string, schema: PluginConfigJsonSchema, metadata: FieldMetadata): boolean | undefined {
  if (metadata.sensitive !== undefined) {
    return metadata.sensitive
  }

  if (schema.sensitive !== undefined) {
    return schema.sensitive
  }

  const normalized = path.toLowerCase()
  return normalized.includes('api_key') ||
    normalized.includes('token') ||
    normalized.includes('secret') ||
    normalized.includes('password')
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
    return '键值对象'
  }

  const valueSchema = schema.additionalProperties

  if (Array.isArray(valueSchema.oneOf) && valueSchema.oneOf.length > 0) {
    return '键值对象：联合类型'
  }

  if (valueSchema.type) {
    if (valueSchema.type === 'object') {
      return '键值对象：对象值'
    }
    return `键值对象：${localizeSchemaType(valueSchema.type)}`
  }

  return '键值对象'
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
    const sensitive = inferSensitive(path, childSchema, metadata)
    const readOnlySupportNote = inferReadOnlySupportNote(path, childSchema, metadata)

    if (fieldType === 'object') {
      fields.push(...flattenJsonSchema(childSchema, context, path))
      continue
    }

    fields.push(
      createField({
        path,
        key,
        label: localizeFieldLabel(path, metadata.label ?? key),
        constValue: childSchema.const,
        description: localizeSchemaCopy(metadata.description),
        type: fieldType,
        required: required.has(key),
        readOnly,
        sensitive,
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
            ? '首版以 JSON 文本区域编辑键值对象，并展示字段名规则。'
            : fieldType === 'union'
              ? '首版展示可区分联合类型摘要，不提供分支级专用子表单。'
              : fieldType === 'array' && childSchema.items?.type === 'object'
                ? '首版以 JSON 文本区域编辑复杂对象数组。'
                : undefined),
      }),
    )
  }

  return fields
}

const fieldLabelMap: Record<string, string> = {
  api_key: 'API Key',
  api_key_ref: 'API Key 引用',
  channel_allowlist: '频道白名单',
  default_max_results: '默认最大结果数',
  default_search_depth: '默认搜索深度',
  feeds: '订阅源',
  guild_allowlist: '服务器白名单',
  headers: '请求头',
  include_content: '包含正文',
  include_favicon: '包含站点图标',
  include_raw_content: '包含原始内容',
  max_content_chars: '最大正文字符数',
  max_items_per_feed: '每个订阅源最大条数',
  max_response_bytes: '最大响应字节数',
  min_text_length: '最小文本长度',
  public_key: '应用公钥',
  public_key_ref: '应用公钥引用',
  query: '默认查询',
  response_text: '响应文本',
  timeout_seconds: '超时时间（秒）',
  timestamp_tolerance_seconds: '时间戳容忍窗口（秒）',
  url: '网页 URL',
  user_agent: 'User-Agent',
  watchlist_name: '关注列表名称',
  webhook_secret_ref: 'Webhook 密钥引用',
}

const copyMap: Record<string, string> = {
  'Accepted freshness window for Discord signature timestamps.': 'Discord 签名时间戳允许的有效窗口。',
  'Default query used when source.fetch input omits query.': 'source.fetch 输入未提供 query 时使用的默认查询。',
  'Demo Placeholder Source Plugin Config': '占位数据源插件配置',
  'Example Industry Package Config': '示例行业包配置',
  'Minimal response text returned for supported application commands.': '支持的应用命令返回的最小响应文本。',
  'Non-sensitive public request headers only. Authorization, Cookie, and API-key style headers are not allowed here.': '仅允许非敏感公共请求头；Authorization、Cookie 和 API-key 类请求头不允许配置在这里。',
  'Optional channel allowlist for Discord interactions.': 'Discord 交互允许的频道白名单，可选。',
  'Optional guild allowlist for Discord interactions.': 'Discord 交互允许的服务器白名单，可选。',
  'Platform-resolved Tavily API key value. Platform validates and injects before plugin load.': '由平台解析的 Tavily API key。平台会在插件加载前完成校验和注入。',
  'Readability Link Reader Config': 'Readability 链接阅读器配置',
  'Registry provided plugin config JSON Schema.': '插件注册表提供的配置结构。',
  'Reference to the Discord application public key for standalone receive tests.': 'Discord 应用公钥引用，用于独立接收测试。',
  'Request timeout used for Discord webhook send requests.': 'Discord webhook 发送请求使用的超时时间。',
  'Resolved Discord application public key injected by the host for real ingress.': '由宿主注入的 Discord 应用公钥，用于真实入口校验。',
  'RSS Source Config': 'RSS 数据源配置',
  'Secret reference that resolves to the full Discord webhook URL.': '解析为完整 Discord webhook URL 的 secret 引用。',
  'Tavily Source Tool Config': 'Tavily 数据源工具配置',
  'Tavily API key. The platform stores it encrypted and injects it before plugin load.': 'Tavily API key。平台会加密保存，并在插件运行前注入。',
}

function localizeFieldLabel(path: string, label: string): string {
  const normalized = label.trim()
  const key = path.split('.').at(-1) ?? normalized

  return fieldLabelMap[key] ?? fieldLabelMap[normalized] ?? normalized
}

export function localizeSchemaCopy(value: string | undefined): string | undefined {
  if (!value) {
    return value
  }

  return copyMap[value] ?? value
}

function localizeSchemaType(type: string | string[]): string {
  const normalized = Array.isArray(type) ? type.join(' / ') : type
  const typeMap: Record<string, string> = {
    any: '任意值',
    boolean: '布尔值',
    integer: '整数',
    number: '数字',
    object: '对象',
    string: '字符串',
  }

  return typeMap[normalized] ?? normalized
}

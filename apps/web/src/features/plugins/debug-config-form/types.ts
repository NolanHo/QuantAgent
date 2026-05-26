export type PluginConfigDebugState =
  | 'idle'
  | 'loading'
  | 'empty'
  | 'validation-error'
  | 'save-pending'
  | 'save-success'
  | 'save-failure'

export type PluginConfigSupportLevel = 'degraded' | 'supported' | 'unsupported'

export type PluginRecord = {
  id: string
  name: string
  source: 'official' | 'runtime'
  status: string
}

export type PluginConfigSchemaFieldType =
  | 'array'
  | 'boolean'
  | 'integer'
  | 'number'
  | 'object'
  | 'record'
  | 'string'
  | 'union'

export type PluginConfigJsonSchema = {
  $schema?: string
  additionalProperties?: PluginConfigJsonSchema | boolean
  const?: unknown
  default?: unknown
  description?: string
  enum?: unknown[]
  exclusiveMaximum?: number
  exclusiveMinimum?: number
  format?: string
  items?: PluginConfigJsonSchema
  maximum?: number
  maxItems?: number
  maxLength?: number
  minimum?: number
  minItems?: number
  minLength?: number
  oneOf?: PluginConfigJsonSchema[]
  pattern?: string
  properties?: Record<string, PluginConfigJsonSchema>
  propertyNames?: PluginConfigJsonSchema
  required?: string[]
  title?: string
  type?: string | string[]
}

export type PluginConfigFieldDefinition = {
  path: string
  key: string
  label: string
  description?: string
  type: PluginConfigSchemaFieldType
  required: boolean
  sensitive?: boolean
  placeholder?: string
  defaultValue?: unknown
  enumValues?: string[]
  recordValueShape?: string
  unionOptions?: string[]
  examples?: string[]
  constraints?: {
    exclusiveMaximum?: number
    exclusiveMinimum?: number
    format?: string
    maximum?: number
    maxItems?: number
    maxLength?: number
    minimum?: number
    minItems?: number
    minLength?: number
    pattern?: string
  }
  support: PluginConfigSupportLevel
  supportNote?: string
}

export type PluginConfigSchemaSnapshot = {
  pluginId: string
  pluginName: string
  schemaTitle: string
  schemaDescription: string
  schemaSource: 'debug-mock' | 'registry-api'
  fields: PluginConfigFieldDefinition[]
  supportMatrix: Array<{
    feature: string
    level: PluginConfigSupportLevel
    note: string
  }>
}

export type PluginConfigValueMap = Record<string, string>

export type PluginConfigSnapshot = {
  values: PluginConfigValueMap
  maskedPaths: string[]
  versionTag: string
}

export type PluginConfigValidationIssue = {
  path: string
  message: string
}

export type PluginConfigValidationResult = {
  issues: PluginConfigValidationIssue[]
  ok: boolean
}

export type PluginConfigSaveResult = {
  updatedAt: string
  versionTag: string
}

export type PluginConfigDebugFixture = {
  jsonSchema: PluginConfigJsonSchema
  schema: PluginConfigSchemaSnapshot
  config: PluginConfigSnapshot
}

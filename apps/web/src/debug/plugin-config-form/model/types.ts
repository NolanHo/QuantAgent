import type {
  PluginConfigJsonSchema,
  PluginConfigSchemaSnapshot,
  PluginConfigSnapshot,
} from '@/features/plugins/config-form'

export type PluginConfigDebugState =
  | 'idle'
  | 'loading'
  | 'empty'
  | 'load-failure'
  | 'validation-error'
  | 'save-pending'
  | 'save-success'
  | 'save-failure'

export type PluginRecord = {
  id: string
  name: string
  source: 'official' | 'runtime'
  status: string
}

export type PluginConfigDebugFixture = {
  jsonSchema: PluginConfigJsonSchema
  schema: PluginConfigSchemaSnapshot
  config: PluginConfigSnapshot
}

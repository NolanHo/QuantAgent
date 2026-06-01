import {
  parseConfigDraftPayload,
  type PluginConfigSchemaSnapshot,
  type PluginConfigValueMap,
} from '@/features/plugins/config-form'

export function buildPreviewPayloadAsJson(
  schema: PluginConfigSchemaSnapshot,
  values: PluginConfigValueMap,
): string {
  return JSON.stringify(parseConfigDraftPayload(schema, values))
}

import { useMutation } from '@tanstack/react-query'

import type {
  PluginConfigSchemaSnapshot,
  PluginConfigValueMap,
} from '../types/plugin-config.types'

export function usePluginConfigSaveMutation<TSaveResult>(
  schema: PluginConfigSchemaSnapshot | null,
  saveDraft: (
    schema: PluginConfigSchemaSnapshot,
    values: PluginConfigValueMap,
  ) => Promise<TSaveResult>,
) {
  return useMutation({
    mutationFn: (values: PluginConfigValueMap) => {
      if (!schema) {
        throw new Error('保存前需要先加载配置结构。')
      }

      return saveDraft(schema, values)
    },
  })
}

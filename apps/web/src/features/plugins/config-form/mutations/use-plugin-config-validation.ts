import { useMutation } from '@tanstack/react-query'

import type {
  PluginConfigSchemaSnapshot,
  PluginConfigValidationResult,
  PluginConfigValueMap,
} from '../types/plugin-config.types'

export function usePluginConfigValidationMutation(
  schema: PluginConfigSchemaSnapshot | null,
  validateDraft: (
    schema: PluginConfigSchemaSnapshot,
    values: PluginConfigValueMap,
  ) => Promise<PluginConfigValidationResult>,
) {
  return useMutation({
    mutationFn: (values: PluginConfigValueMap) => {
      if (!schema) {
        throw new Error('校验前需要先加载配置结构。')
      }

      return validateDraft(schema, values)
    },
  })
}

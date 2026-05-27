import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'

import type {
  PluginConfigSnapshot,
  PluginConfigSchemaSnapshot,
  PluginConfigValidationIssue,
  PluginConfigValidationResult,
  PluginConfigValueMap,
} from './types'
import {
  issueMap,
  normalizeInitialValues,
  updateValueMap,
} from './lib/model'

export function usePluginConfigSchemaQuery(
  pluginId: string,
  loadSchema: (pluginId: string) => Promise<PluginConfigSchemaSnapshot>,
) {
  return useQuery({
    enabled: pluginId.length > 0,
    queryFn: () => loadSchema(pluginId),
    queryKey: ['plugin-config-schema', pluginId],
  })
}

export function usePluginCurrentConfigQuery(
  pluginId: string,
  loadConfig: (pluginId: string) => Promise<PluginConfigSnapshot>,
) {
  return useQuery({
    enabled: pluginId.length > 0,
    queryFn: () => loadConfig(pluginId),
    queryKey: ['plugin-current-config', pluginId],
  })
}

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
        throw new Error('Schema is required before validation.')
      }

      return validateDraft(schema, values)
    },
  })
}

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
        throw new Error('Schema is required before save.')
      }

      return saveDraft(schema, values)
    },
  })
}

export function usePluginConfigDraftState(
  schema: PluginConfigSchemaSnapshot | null,
  config: PluginConfigSnapshot | null,
) {
  const [draftValues, setDraftValues] = useState<PluginConfigValueMap>({})
  const [issues, setIssues] = useState<PluginConfigValidationIssue[]>([])

  useEffect(() => {
    if (!schema || !config) {
      return
    }

    setDraftValues(normalizeInitialValues(schema.fields, config.values))
    setIssues([])
  }, [config, schema])

  const issueLookup = useMemo(() => issueMap(issues), [issues])

  function updateDraft(path: string, nextValue: string) {
    setDraftValues((current) => updateValueMap(current, path, nextValue))
  }

  function resetDraftState(nextConfig: PluginConfigSnapshot) {
    if (!schema) {
      return
    }

    setDraftValues(normalizeInitialValues(schema.fields, nextConfig.values))
    setIssues([])
  }

  return {
    draftValues,
    issueLookup,
    issues,
    resetDraftState,
    setIssues,
    updateDraft,
  }
}

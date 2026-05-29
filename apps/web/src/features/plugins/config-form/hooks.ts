import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react'
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
  validateSchemaFields,
} from './lib/model'

export function usePluginConfigSchemaQuery(
  pluginId: string,
  loadSchema: (pluginId: string) => Promise<PluginConfigSchemaSnapshot>,
) {
  return useQuery({
    enabled: pluginId.length > 0,
    queryFn: () => loadSchema(pluginId),
    queryKey: ['plugin-config-schema', pluginId],
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
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
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
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
  const initialDraftValues = useMemo(
    () => (schema && config ? normalizeInitialValues(schema.fields, config.values) : {}),
    [config, schema],
  )
  const [draftValues, setDraftValues] = useState<PluginConfigValueMap>({})
  const [issues, setIssues] = useState<PluginConfigValidationIssue[]>([])
  const deferredDraftValues = useDeferredValue(draftValues)

  useEffect(() => {
    if (!schema || !config) {
      return
    }

    setDraftValues(initialDraftValues)
    setIssues([])
  }, [config, initialDraftValues, schema])

  useEffect(() => {
    if (!schema) {
      return
    }

    // 字段值优先更新，字段级校验退到低优先级，避免长表单输入被同步校验拖慢。
    startTransition(() => {
      setIssues(validateSchemaFields(schema, deferredDraftValues).issues)
    })
  }, [deferredDraftValues, schema])

  const issueLookup = useMemo(() => issueMap(issues), [issues])
  const isDirty = useMemo(
    () => !isSameValueMap(draftValues, initialDraftValues),
    [draftValues, initialDraftValues],
  )

  const updateDraft = useCallback((path: string, nextValue: string) => {
    setDraftValues((current) => updateValueMap(current, path, nextValue))
  }, [])

  const resetDraftState = useCallback((nextConfig: PluginConfigSnapshot) => {
    if (!schema) {
      return
    }

    setDraftValues(normalizeInitialValues(schema.fields, nextConfig.values))
    setIssues([])
  }, [schema])

  return {
    draftValues,
    initialDraftValues,
    isDirty,
    issueLookup,
    issues,
    resetDraftState,
    setIssues,
    updateDraft,
  }
}

function isSameValueMap(
  left: PluginConfigValueMap,
  right: PluginConfigValueMap,
): boolean {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)

  if (leftKeys.length !== rightKeys.length) {
    return false
  }

  for (const key of leftKeys) {
    if (left[key] !== right[key]) {
      return false
    }
  }

  return true
}

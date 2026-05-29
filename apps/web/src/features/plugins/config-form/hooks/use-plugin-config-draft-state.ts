import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react'

import type {
  PluginConfigSnapshot,
  PluginConfigSchemaSnapshot,
  PluginConfigValidationIssue,
  PluginConfigValueMap,
} from '../types/plugin-config.types'
import {
  issueMap,
  normalizeInitialValues,
  updateValueMap,
  validateSchemaFields,
} from '../utils/plugin-config-draft'

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

  const clearDraftState = useCallback(() => {
    setDraftValues({})
    setIssues([])
  }, [])

  return {
    clearDraftState,
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

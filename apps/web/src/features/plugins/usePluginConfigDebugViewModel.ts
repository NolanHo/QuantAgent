import { useEffect, useMemo, useState } from 'react'

import { ApiError } from '@/shared/api'

import {
  useDebugPluginRecords,
  usePluginConfigSave,
  usePluginConfigSchema,
  usePluginConfigValidation,
  usePluginCurrentConfig,
} from './queries'
import { issueMap, normalizeInitialValues, statusCopy } from './plugin-config-debug-model'
import type { PluginConfigDebugState, PluginConfigValidationIssue } from './types'

export function usePluginConfigDebugViewModel() {
  const pluginsQuery = useDebugPluginRecords()
  const plugins = pluginsQuery.data ?? []
  const firstPluginId = plugins[0]?.id ?? ''
  const [selectedPluginId, setSelectedPluginId] = useState('')
  const schemaQuery = usePluginConfigSchema(selectedPluginId)
  const configQuery = usePluginCurrentConfig(selectedPluginId)
  const validationMutation = usePluginConfigValidation(schemaQuery.data ?? null)
  const saveMutation = usePluginConfigSave(schemaQuery.data ?? null)
  const [draftValues, setDraftValues] = useState<Record<string, string>>({})
  const [state, setState] = useState<PluginConfigDebugState>('idle')
  const [issues, setIssues] = useState<PluginConfigValidationIssue[]>([])
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedPluginId && firstPluginId) {
      setSelectedPluginId(firstPluginId)
    }
  }, [firstPluginId, selectedPluginId])

  useEffect(() => {
    if (selectedPluginId) {
      setState('loading')
    }
  }, [selectedPluginId])

  useEffect(() => {
    if (!schemaQuery.data || !configQuery.data) {
      return
    }

    setDraftValues(normalizeInitialValues(schemaQuery.data.fields, configQuery.data.values))
    setIssues([])
    setSaveMessage(null)
    setState(schemaQuery.data.fields.length === 0 ? 'empty' : 'idle')
  }, [configQuery.data, schemaQuery.data])

  const issueLookup = useMemo(() => issueMap(issues), [issues])
  const currentStatus = useMemo(() => statusCopy(state), [state])

  function updateDraft(path: string, nextValue: string) {
    setDraftValues((current) => ({
      ...current,
      [path]: nextValue,
    }))
  }

  async function validateDraft() {
    if (!schemaQuery.data) {
      return
    }

    const result = await validationMutation.mutateAsync(draftValues)
    setIssues(result.issues)
    setState(result.ok ? 'idle' : 'validation-error')
    if (result.ok) {
      setSaveMessage('当前草稿通过 mock validate，可继续测试保存流程。')
    } else {
      setSaveMessage(null)
    }
  }

  async function saveDraft() {
    if (!schemaQuery.data) {
      return
    }

    const validationResult = await validationMutation.mutateAsync(draftValues)
    setIssues(validationResult.issues)
    if (!validationResult.ok) {
      setState('validation-error')
      setSaveMessage(null)
      return
    }

    setState('save-pending')
    setSaveMessage(null)

    try {
      const result = await saveMutation.mutateAsync(draftValues)
      setState('save-success')
      setSaveMessage(`已写入 debug mock snapshot，版本标签：${result.versionTag}`)
      if (schemaQuery.data.fields.some((field) => field.sensitive)) {
        const nextConfig = await configQuery.refetch()
        if (nextConfig.data) {
          setDraftValues(normalizeInitialValues(schemaQuery.data.fields, nextConfig.data.values))
        }
      }
    } catch (error) {
      const message = error instanceof ApiError || error instanceof Error ? error.message : '保存失败'
      setState('save-failure')
      setSaveMessage(message)
    }
  }

  return {
    config: configQuery.data ?? null,
    currentStatus,
    draftValues,
    isLoading:
      pluginsQuery.isLoading ||
      (selectedPluginId.length > 0 && (schemaQuery.isLoading || configQuery.isLoading)),
    issueLookup,
    plugins,
    saveDraft,
    saveMessage,
    schema: schemaQuery.data ?? null,
    selectedPluginId,
    selectPlugin: setSelectedPluginId,
    updateDraft,
    validateDraft,
  }
}

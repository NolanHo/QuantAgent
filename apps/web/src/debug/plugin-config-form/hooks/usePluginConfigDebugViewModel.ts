import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { fetchPluginConfigJsonSchema } from '@/shared/api'
import { useAuth } from '@/shared/auth'
import {
  usePluginConfigDraftState,
  usePluginConfigSaveMutation,
  usePluginConfigSchemaQuery,
  usePluginConfigValidationMutation,
  usePluginCurrentConfigQuery,
} from '@/features/plugins/config-form'
import type { PluginConfigDebugState } from '../model'

import {
  fetchPluginConfigSchema,
  fetchPluginCurrentConfig,
  savePluginConfigDraft,
  validatePluginConfigDraft,
} from '../data/api'
import { listDebugPluginFixtures } from '../data/debug-fixtures'
import { toUiErrorMessage } from '../data/utils'
import { statusCopy } from '../model'

export function usePluginConfigDebugViewModel() {
  const { apiClient } = useAuth()
  const pluginsQuery = useQuery({
    queryFn: async () => listDebugPluginFixtures(),
    queryKey: ['debug-plugin-records'],
    staleTime: Number.POSITIVE_INFINITY,
  })
  const plugins = pluginsQuery.data ?? []
  const firstPluginId = plugins[0]?.id ?? ''
  const [selectedPluginId, setSelectedPluginId] = useState('')
  const schemaQuery = usePluginConfigSchemaQuery(
    selectedPluginId,
    (pluginId) => fetchPluginConfigSchema(
      (currentPluginId) => fetchPluginConfigJsonSchema(apiClient, currentPluginId),
      pluginId,
    ),
  )
  const configQuery = usePluginCurrentConfigQuery(selectedPluginId, fetchPluginCurrentConfig)
  const validationMutation = usePluginConfigValidationMutation(
    schemaQuery.data ?? null,
    validatePluginConfigDraft,
  )
  const saveMutation = usePluginConfigSaveMutation(
    schemaQuery.data ?? null,
    savePluginConfigDraft,
  )
  const {
    draftValues,
    isDirty,
    issueLookup,
    resetDraftState,
    setIssues,
    updateDraft,
  } = usePluginConfigDraftState(schemaQuery.data ?? null, configQuery.data ?? null)
  const [state, setState] = useState<PluginConfigDebugState>('idle')
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

    setSaveMessage(null)
    setState(schemaQuery.data.fields.length === 0 ? 'empty' : 'idle')
  }, [configQuery.data, schemaQuery.data])

  const currentStatus = useMemo(() => statusCopy(state), [state])

  async function validateDraft() {
    if (!schemaQuery.data) {
      return false
    }

    try {
      const result = await validationMutation.mutateAsync(draftValues)
      setIssues(result.issues)
      setState(result.ok ? 'idle' : 'validation-error')
      setSaveMessage(result.ok ? '当前草稿通过 mock validate，可继续测试保存流程。' : null)
      return result.ok
    } catch (error) {
      setIssues([])
      setState('validation-error')
      setSaveMessage(toUiErrorMessage(error, '校验失败'))
      return false
    }
  }

  async function saveDraft() {
    if (!schemaQuery.data) {
      return false
    }

    let validationResult
    try {
      validationResult = await validationMutation.mutateAsync(draftValues)
    } catch (error) {
      setIssues([])
      setState('validation-error')
      setSaveMessage(toUiErrorMessage(error, '校验失败'))
      return false
    }

    setIssues(validationResult.issues)
    if (!validationResult.ok) {
      setState('validation-error')
      setSaveMessage(null)
      return false
    }

    setState('save-pending')
    setSaveMessage(null)

    try {
      const result = await saveMutation.mutateAsync(draftValues)
      setState('save-success')
      const nextSaveMessage = `已写入 debug mock snapshot，版本标签：${result.versionTag}`
      const nextConfig = await configQuery.refetch()
      if (nextConfig.data) {
        resetDraftState(nextConfig.data)
      }
      setSaveMessage(nextSaveMessage)
      return true
    } catch (error) {
      setState('save-failure')
      setSaveMessage(toUiErrorMessage(error, '保存失败'))
      return false
    }
  }

  function resetDraft() {
    if (!configQuery.data) {
      return
    }

    resetDraftState(configQuery.data)
    setSaveMessage(null)
    setState(schemaQuery.data?.fields.length ? 'idle' : 'empty')
  }

  return {
    config: configQuery.data ?? null,
    currentStatus,
    draftValues,
    isDirty,
    isLoading:
      pluginsQuery.isLoading ||
      (selectedPluginId.length > 0 && (schemaQuery.isLoading || configQuery.isLoading)),
    issueLookup,
    plugins,
    resetDraft,
    saveDraft,
    savePending: saveMutation.isPending,
    saveMessage,
    schema: schemaQuery.data ?? null,
    selectedPluginId,
    selectPlugin: setSelectedPluginId,
    state,
    updateDraft,
    validateDraft,
  }
}

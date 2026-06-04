import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { useApis } from '@/app/runtime'
import {
  usePluginConfigDraftState,
  usePluginConfigSaveMutation,
  usePluginConfigSchemaQuery,
  usePluginConfigValidationMutation,
  usePluginCurrentConfigQuery,
} from '@/features/plugins/config-form'
import type { PluginConfigDebugState } from '../model'
import type { PluginConfigSnapshot } from '@/features/plugins/config-form'

import {
  fetchPluginConfigSchema,
  fetchPluginCurrentConfigWithFallback,
  PluginConfigValidationError,
  savePluginConfigDraftWithFallback,
  validatePluginConfigDraftWithFallback,
} from '../data/adapters/remote-config'
import { listDebugPluginFixtures } from '../data/fixtures/debug-fixtures'
import { toUiErrorMessage } from '../data/utils/ui-error'
import { statusCopy } from '../model'

export function usePluginConfigDebugViewModel() {
  const { plugins: pluginsApi } = useApis()
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
      (currentPluginId) => pluginsApi.fetchConfigSchema(currentPluginId),
      pluginId,
    ),
  )
  const configQuery = usePluginCurrentConfigQuery(
    selectedPluginId,
    (pluginId) => fetchPluginCurrentConfigWithFallback(pluginsApi, pluginId),
  )
  const validationMutation = usePluginConfigValidationMutation(
    schemaQuery.data ?? null,
    (schema, values) => validatePluginConfigDraftWithFallback(pluginsApi, schema, values),
  )
  const saveMutation = usePluginConfigSaveMutation(
    schemaQuery.data ?? null,
    (schema, values) => savePluginConfigDraftWithFallback(pluginsApi, schema, values),
  )
  const {
    clearDraftState,
    draftValues,
    isDirty,
    issueLookup,
    resetDraftState,
    setIssues,
    updateDraft,
  } = usePluginConfigDraftState(schemaQuery.data ?? null, configQuery.data ?? null)
  const [state, setState] = useState<PluginConfigDebugState>('idle')
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const loadError = pluginsQuery.error ?? schemaQuery.error ?? configQuery.error ?? null
  const loadErrorMessage = loadError ? toUiErrorMessage(loadError, '加载插件配置失败') : null

  useEffect(() => {
    if (!selectedPluginId && firstPluginId) {
      setSelectedPluginId(firstPluginId)
    }
  }, [firstPluginId, selectedPluginId])

  useEffect(() => {
    if (pluginsQuery.isLoading || firstPluginId) {
      return
    }

    setSelectedPluginId('')
    clearDraftState()
    setSaveMessage(null)
    setState('empty')
  }, [clearDraftState, firstPluginId, pluginsQuery.isLoading])

  useEffect(() => {
    if (selectedPluginId) {
      setState('loading')
    }
  }, [selectedPluginId])

  useEffect(() => {
    if (loadError) {
      clearDraftState()
      setSaveMessage(loadErrorMessage)
      setState('load-failure')
      return
    }

    if (!schemaQuery.data || !configQuery.data) {
      return
    }

    setSaveMessage(null)
    setState(schemaQuery.data.fields.length === 0 ? 'empty' : 'idle')
  }, [clearDraftState, configQuery.data, loadError, loadErrorMessage, schemaQuery.data])

  const currentStatus = useMemo(() => statusCopy(state), [state])

  async function validateDraft() {
    if (!schemaQuery.data) {
      return false
    }

    try {
      const result = await validationMutation.mutateAsync(draftValues)
      setIssues(result.issues)
      setState(result.ok ? 'idle' : 'validation-error')
      setSaveMessage(result.ok ? '当前草稿校验通过，可继续测试保存流程。' : null)
      return result.ok
    } catch (error) {
      setIssues([])
      setState('validation-error')
      setSaveMessage(toUiErrorMessage(error, '校验失败'))
      return false
    }
  }

  function applyValidationError(error: PluginConfigValidationError) {
    setIssues(error.result.issues)
    setState('validation-error')
    setSaveMessage(null)
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
      const nextSaveMessage = `已完成受控保存，版本标签：${result.versionTag}`
      const nextConfig = await configQuery.refetch()
      if (nextConfig.data) {
        resetDraftState(nextConfig.data)
      }
      setSaveMessage(nextSaveMessage)
      return true
    } catch (error) {
      if (error instanceof PluginConfigValidationError) {
        applyValidationError(error)
        return false
      }

      setState('save-failure')
      setSaveMessage(toUiErrorMessage(error, '保存失败'))
      return false
    }
  }

  function resetDraft(nextConfig?: PluginConfigSnapshot) {
    const resetTarget = nextConfig ?? configQuery.data
    if (!resetTarget) {
      return
    }

    resetDraftState(resetTarget)
    setSaveMessage(null)
    setState(schemaQuery.data?.fields.length ? 'idle' : 'empty')
  }

  const canReset =
    Boolean(configQuery.data) &&
    (
      isDirty ||
      state === 'save-success' ||
      state === 'save-failure' ||
      state === 'validation-error'
    )

  return {
    canReset,
    config: configQuery.data ?? null,
    currentStatus,
    draftValues,
    isDirty,
    isLoading:
      pluginsQuery.isLoading ||
      (selectedPluginId.length > 0 && (schemaQuery.isLoading || configQuery.isLoading)),
    issueLookup,
    loadErrorMessage,
    plugins,
    resetDraft,
    saveDraft,
    // UI 只依赖本次保存状态机，避免被 mutation 对象的历史 pending 状态卡住按钮。
    savePending: state === 'save-pending',
    saveMessage,
    schema: schemaQuery.data ?? null,
    selectedPluginId,
    selectPlugin: setSelectedPluginId,
    state,
    updateDraft,
    validateDraft,
  }
}

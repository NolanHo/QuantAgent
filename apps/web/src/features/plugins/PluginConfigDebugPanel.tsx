import type { CSSProperties, JSX } from 'react'
import { useEffect, useMemo, useState } from 'react'

import { PageEmpty } from '@/app/components/PageEmpty'
import { PageLoading } from '@/app/components/PageLoading'
import { PlaceholderPanel } from '@/app/components/PlaceholderPanel'
import { ApiError } from '@/shared/api'

import {
  useDebugPluginRecords,
  usePluginConfigSave,
  usePluginConfigSchema,
  usePluginConfigValidation,
  usePluginCurrentConfig,
} from './queries'
import type {
  PluginConfigDebugState,
  PluginConfigFieldDefinition,
  PluginConfigSupportLevel,
  PluginConfigValidationIssue,
} from './types'

const panelGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '14px',
  marginTop: 'var(--qa-spacing-lg)',
}

const formGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.65fr) minmax(280px, 0.95fr)',
  gap: '20px',
  alignItems: 'start',
  marginTop: 'var(--qa-spacing-xl)',
}

const cardStyle: CSSProperties = {
  border: '1px solid var(--qa-color-border-subtle)',
  borderRadius: 'var(--qa-radius-xl)',
  background: 'var(--qa-color-surface)',
  padding: '18px',
}

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: '18px',
  fontWeight: 700,
}

const fieldStackStyle: CSSProperties = {
  display: 'grid',
  gap: '14px',
  marginTop: 'var(--qa-spacing-lg)',
}

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: '8px',
}

const labelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '14px',
  fontWeight: 700,
  color: 'var(--qa-color-text-strong)',
}

const inputStyle: CSSProperties = {
  minHeight: '42px',
  border: '1px solid var(--qa-color-border-strong)',
  borderRadius: 'var(--qa-radius-lg)',
  padding: '10px 12px',
  background: 'var(--qa-color-background)',
  color: 'var(--qa-color-text-strong)',
}

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: '122px',
  resize: 'vertical',
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontSize: '13px',
}

const badgeBaseStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '4px 10px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 700,
}

const buttonRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '12px',
  marginTop: 'var(--qa-spacing-lg)',
}

const primaryButtonStyle: CSSProperties = {
  minHeight: '40px',
  border: '1px solid var(--qa-color-primary)',
  borderRadius: 'var(--qa-radius-lg)',
  background: 'var(--qa-color-primary)',
  color: 'var(--qa-color-on-primary)',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 700,
  padding: '0 16px',
}

const secondaryButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  background: 'var(--qa-color-surface)',
  border: '1px solid var(--qa-color-border-strong)',
  color: 'var(--qa-color-text-strong)',
}

const asideListStyle: CSSProperties = {
  display: 'grid',
  gap: '12px',
  marginTop: 'var(--qa-spacing-lg)',
}

function supportBadgeStyle(level: PluginConfigSupportLevel): CSSProperties {
  if (level === 'supported') {
    return {
      ...badgeBaseStyle,
      background: 'rgba(17, 135, 90, 0.12)',
      color: 'rgb(17, 135, 90)',
    }
  }

  if (level === 'degraded') {
    return {
      ...badgeBaseStyle,
      background: 'rgba(184, 98, 0, 0.12)',
      color: 'rgb(164, 87, 0)',
    }
  }

  return {
    ...badgeBaseStyle,
    background: 'rgba(175, 52, 45, 0.12)',
    color: 'rgb(161, 43, 37)',
  }
}

function statusCopy(state: PluginConfigDebugState): { detail: string; title: string } {
  switch (state) {
    case 'loading':
      return { title: 'Loading', detail: '正在加载 schema 与当前配置快照。' }
    case 'empty':
      return { title: 'Empty', detail: '当前没有可用的配置样例或字段。' }
    case 'validation-error':
      return { title: 'Validation Error', detail: '字段级校验失败，需先修正表单。' }
    case 'save-pending':
      return { title: 'Save Pending', detail: '正在执行受控保存，不写入正式业务接口。' }
    case 'save-success':
      return { title: 'Save Success', detail: '当前草稿已通过 mock save 流程。' }
    case 'save-failure':
      return { title: 'Save Failure', detail: '保存失败分支已触发，可用于验证错误反馈。' }
    default:
      return { title: 'Ready', detail: '当前处于受控调试态，可验证字段映射与状态机。' }
  }
}

function normalizeInitialValues(
  schemaFields: PluginConfigFieldDefinition[],
  values: Record<string, string>,
): Record<string, string> {
  const nextValues: Record<string, string> = { ...values }

  for (const definition of schemaFields) {
    if (nextValues[definition.path] !== undefined) {
      continue
    }

    if (definition.defaultValue === undefined) {
      nextValues[definition.path] = ''
      continue
    }

    nextValues[definition.path] = String(definition.defaultValue)
  }

  return nextValues
}

function issueMap(issues: PluginConfigValidationIssue[]): Map<string, string> {
  return new Map(issues.map((issue) => [issue.path, issue.message]))
}

function splitArrayPreview(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function renderFieldInput(
  definition: PluginConfigFieldDefinition,
  value: string,
  onChange: (path: string, nextValue: string) => void,
): JSX.Element {
  if (definition.type === 'record' || definition.type === 'union' || (definition.type === 'array' && definition.support === 'degraded')) {
    return (
      <textarea
        aria-label={definition.label}
        onChange={(event) => {
          onChange(definition.path, event.target.value)
        }}
        placeholder={definition.placeholder ?? definition.examples?.[0] ?? ''}
        style={textareaStyle}
        value={value}
      />
    )
  }

  if (definition.type === 'boolean') {
    return (
      <select
        aria-label={definition.label}
        onChange={(event) => {
          onChange(definition.path, event.target.value)
        }}
        style={inputStyle}
        value={value}
      >
        <option value="">请选择</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    )
  }

  if (definition.enumValues && definition.enumValues.length > 0) {
    return (
      <select
        aria-label={definition.label}
        onChange={(event) => {
          onChange(definition.path, event.target.value)
        }}
        style={inputStyle}
        value={value}
      >
        <option value="">请选择</option>
        {definition.enumValues.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    )
  }

  return (
    <input
      autoComplete={definition.sensitive ? 'new-password' : undefined}
      aria-label={definition.label}
      onChange={(event) => {
        onChange(definition.path, event.target.value)
      }}
      placeholder={definition.placeholder ?? definition.examples?.[0] ?? ''}
      style={inputStyle}
      type={definition.sensitive ? 'password' : 'text'}
      value={value}
    />
  )
}

export function PluginConfigDebugPanel() {
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

  const currentStatus = statusCopy(state)
  const issueLookup = useMemo(() => issueMap(issues), [issues])

  function updateDraft(path: string, nextValue: string) {
    setDraftValues((current) => ({
      ...current,
      [path]: nextValue,
    }))
  }

  async function handleValidate() {
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

  async function handleSave() {
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

  if (pluginsQuery.isLoading || (selectedPluginId.length > 0 && (schemaQuery.isLoading || configQuery.isLoading))) {
    return <PageLoading message="正在加载插件配置调试样例..." />
  }

  if (!plugins.length) {
    return (
      <PageEmpty
        title="当前没有可用插件样例"
        description="debug 插件配置表单至少需要一个受控样例来验证 schema-driven form 路径。"
      />
    )
  }

  if (!schemaQuery.data || !configQuery.data) {
    return (
      <PageEmpty
        title="当前没有可消费的 schema 快照"
        description="请先选择一个 debug 插件样例，或检查 mock fixture 是否就绪。"
      />
    )
  }

  return (
    <>
      <section style={panelGridStyle} aria-label="插件配置调试概览">
        <PlaceholderPanel title="Schema 来源" copy={schemaQuery.data.schemaSource === 'registry-api' ? '已叠加 registry config-schema 标题信息。' : '当前依赖 debug mock fixture。'} />
        <PlaceholderPanel title="当前状态" copy={`${currentStatus.title} · ${currentStatus.detail}`} />
        <PlaceholderPanel title="非目标" copy="不进入正式 /plugins 页面，不支持插件注入自定义前端组件。" />
      </section>

      <section style={formGridStyle}>
        <section style={cardStyle}>
          <div className="page-header">
            <p className="page-kicker">受控样例</p>
            <h2 className="page-title" style={sectionTitleStyle}>
              {schemaQuery.data.pluginName}
            </h2>
            <p className="page-description">{schemaQuery.data.schemaDescription}</p>
          </div>

          <section style={buttonRowStyle} aria-label="插件样例选择">
            {plugins.map((plugin) => (
              <button
                key={plugin.id}
                onClick={() => {
                  setSelectedPluginId(plugin.id)
                }}
                style={plugin.id === selectedPluginId ? primaryButtonStyle : secondaryButtonStyle}
                type="button"
              >
                {plugin.name}
              </button>
            ))}
          </section>

          <section style={fieldStackStyle}>
            {schemaQuery.data.fields.map((definition) => {
              const message = issueLookup.get(definition.path)
              const value = draftValues[definition.path] ?? ''
              return (
                <label key={definition.path} style={fieldStyle}>
                  <span style={labelStyle}>
                    {definition.label}
                    <span style={supportBadgeStyle(definition.support)}>{definition.support}</span>
                    {definition.sensitive ? (
                      <span style={supportBadgeStyle('degraded')}>masked</span>
                    ) : null}
                  </span>
                  <span style={{ color: 'var(--qa-color-text-subtle)', fontSize: '13px' }}>
                    {definition.description}
                  </span>
                  {renderFieldInput(definition, value, updateDraft)}
                  {definition.type === 'array' && definition.support === 'supported' && value ? (
                    <span style={{ color: 'var(--qa-color-text-subtle)', fontSize: '13px' }}>
                      当前数组项：{splitArrayPreview(value).join(' / ')}
                    </span>
                  ) : null}
                  {definition.supportNote ? (
                    <span style={{ color: 'var(--qa-color-text-subtle)', fontSize: '13px' }}>
                      {definition.supportNote}
                    </span>
                  ) : null}
                  {message ? (
                    <span style={{ color: 'rgb(161, 43, 37)', fontSize: '13px', fontWeight: 700 }}>
                      {message}
                    </span>
                  ) : null}
                </label>
              )
            })}
          </section>

          <section style={buttonRowStyle}>
            <button onClick={() => void handleValidate()} style={secondaryButtonStyle} type="button">
              先做校验
            </button>
            <button onClick={() => void handleSave()} style={primaryButtonStyle} type="button">
              触发保存
            </button>
          </section>

          {saveMessage ? (
            <p style={{ marginTop: 'var(--qa-spacing-md)', color: 'var(--qa-color-text-subtle)' }}>
              {saveMessage}
            </p>
          ) : null}
        </section>

        <aside style={cardStyle}>
          <h2 style={sectionTitleStyle}>Schema Inspect</h2>
          <p className="page-description">
            当前视图只展示受控的 schema 摘要、支持矩阵和状态边界，不接受任意 schema playground 输入。
          </p>

          <section style={asideListStyle} aria-label="支持矩阵">
            {schemaQuery.data.supportMatrix.map((entry) => (
              <div key={entry.feature} style={{ ...cardStyle, padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                  <strong>{entry.feature}</strong>
                  <span style={supportBadgeStyle(entry.level)}>{entry.level}</span>
                </div>
                <p style={{ margin: '8px 0 0', color: 'var(--qa-color-text-subtle)', fontSize: '13px' }}>
                  {entry.note}
                </p>
              </div>
            ))}
          </section>

          <section style={{ marginTop: 'var(--qa-spacing-lg)' }}>
            <h3 style={{ margin: 0, fontSize: '16px' }}>调试态状态机</h3>
            <ul style={{ margin: '10px 0 0', paddingInlineStart: '20px', color: 'var(--qa-color-text-subtle)' }}>
              <li>Loading / Empty：用于验证 schema 与 config 入口状态。</li>
              <li>Validation Error：字段级错误由表单 UI 明确承接。</li>
              <li>Save Pending / Success / Failure：不依赖正式业务接口即可验证保存反馈。</li>
            </ul>
          </section>
        </aside>
      </section>
    </>
  )
}

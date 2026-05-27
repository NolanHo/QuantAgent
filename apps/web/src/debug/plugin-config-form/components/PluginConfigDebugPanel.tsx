import { PageEmpty } from '@/app/components/PageEmpty'
import { PageLoading } from '@/app/components/PageLoading'
import {
  PluginConfigForm,
  PluginConfigSupportMatrix,
} from '@/features/plugins/config-form'
import { Card } from '@heroui/react'
import { usePluginConfigDebugViewModel } from '../hooks'

export function PluginConfigDebugPanel() {
  const {
    config,
    currentStatus,
    draftValues,
    isLoading,
    issueLookup,
    plugins,
    saveDraft,
    saveMessage,
    schema,
    selectPlugin,
    selectedPluginId,
    state,
    updateDraft,
    validateDraft,
  } = usePluginConfigDebugViewModel()

  if (isLoading) {
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

  if (!schema || !config) {
    return (
      <PageEmpty
        title="当前没有可消费的 schema 快照"
        description="请先选择一个 debug 插件样例，或检查 mock fixture 是否就绪。"
      />
    )
  }

  return (
    <>
      <PluginConfigForm
        issueLookup={issueLookup}
        onPrimaryAction={() => void saveDraft()}
        onSecondaryAction={() => void validateDraft()}
        onSelectPlugin={selectPlugin}
        onValueChange={updateDraft}
        plugins={plugins}
        saveMessage={saveMessage}
        saveMessageTone={state === 'save-failure' || state === 'validation-error' ? 'danger' : 'accent'}
        schema={schema}
        selectedPluginId={selectedPluginId}
        statusCards={[
          {
            title: 'Schema 来源',
            copy:
              schema.schemaSource === 'registry-api'
                ? '已叠加 registry config-schema 标题信息。'
                : '当前依赖 debug mock fixture。',
          },
          {
            title: '当前状态',
            copy: `${currentStatus.title} · ${currentStatus.detail}`,
          },
          {
            title: '非目标',
            copy: '不进入正式 /plugins 页面，不支持插件注入自定义前端组件。',
          },
        ]}
        values={draftValues}
      />

      <section style={{ marginTop: 'var(--qa-spacing-xl)' }}>
        <PluginConfigSupportMatrix
          title="Schema Inspect"
          description="当前视图只展示受控的 schema 摘要、支持矩阵和状态边界，不接受任意 schema playground 输入。"
          supportMatrix={schema.supportMatrix}
        />

        <Card style={{ marginTop: 'var(--qa-spacing-lg)' }}>
          <Card.Header>
            <Card.Title>调试态状态机</Card.Title>
          </Card.Header>
          <Card.Content>
            <ul style={{ margin: 0, paddingInlineStart: '20px', color: 'var(--qa-color-text-subtle)' }}>
              <li>加载中 / 空状态：用于验证 schema 与 config 入口状态。</li>
              <li>校验失败：字段级错误由表单 UI 明确承接。</li>
              <li>保存中 / 保存成功 / 保存失败：不依赖正式业务接口即可验证保存反馈。</li>
            </ul>
          </Card.Content>
        </Card>
      </section>
    </>
  )
}

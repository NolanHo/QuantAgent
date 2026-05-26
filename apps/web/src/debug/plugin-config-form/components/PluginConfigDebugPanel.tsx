import { PageEmpty } from '@/app/components/PageEmpty'
import { PageLoading } from '@/app/components/PageLoading'
import {
  PluginConfigForm,
} from '@/features/plugins/config-form'
import { usePluginConfigDebugViewModel } from '../hooks'

export function PluginConfigDebugPanel() {
  const viewModel = usePluginConfigDebugViewModel()

  if (viewModel.isLoading) {
    return <PageLoading message="正在加载插件配置调试样例..." />
  }

  if (!viewModel.plugins.length) {
    return (
      <PageEmpty
        title="当前没有可用插件样例"
        description="debug 插件配置表单至少需要一个受控样例来验证 schema-driven form 路径。"
      />
    )
  }

  if (!viewModel.schema || !viewModel.config) {
    return (
      <PageEmpty
        title="当前没有可消费的 schema 快照"
        description="请先选择一个 debug 插件样例，或检查 mock fixture 是否就绪。"
      />
    )
  }

  return (
    <PluginConfigForm
      issueLookup={viewModel.issueLookup}
      onPrimaryAction={() => void viewModel.saveDraft()}
      onSecondaryAction={() => void viewModel.validateDraft()}
      onSelectPlugin={viewModel.selectPlugin}
      onValueChange={viewModel.updateDraft}
      plugins={viewModel.plugins}
      saveMessage={viewModel.saveMessage}
      saveMessageTone={viewModel.state === 'save-failure' || viewModel.state === 'validation-error' ? 'danger' : 'accent'}
      schema={viewModel.schema}
      selectedPluginId={viewModel.selectedPluginId}
      statusCards={[
        {
          title: 'Schema 来源',
          copy:
            viewModel.schema.schemaSource === 'registry-api'
              ? '已叠加 registry config-schema 标题信息。'
              : '当前依赖 debug mock fixture。',
        },
        {
          title: '当前状态',
          copy: `${viewModel.currentStatus.title} · ${viewModel.currentStatus.detail}`,
        },
        {
          title: '非目标',
          copy: '不进入正式 /plugins 页面，不支持插件注入自定义前端组件。',
        },
      ]}
      values={viewModel.draftValues}
    />
  )
}

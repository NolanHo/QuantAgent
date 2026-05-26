import { PageEmpty } from '@/app/components/PageEmpty'
import { PageLoading } from '@/app/components/PageLoading'
import { PlaceholderPanel } from '@/app/components/PlaceholderPanel'

import {
  buttonRowStyle,
  cardStyle,
  fieldStackStyle,
  formGridStyle,
  panelGridStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
  sectionTitleStyle,
} from './PluginConfigDebug.styles'
import { PluginConfigField } from './PluginConfigField'
import { PluginConfigSupportMatrix } from './PluginConfigSupportMatrix'
import { usePluginConfigDebugViewModel } from './usePluginConfigDebugViewModel'

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
    <>
      <section style={panelGridStyle} aria-label="插件配置调试概览">
        <PlaceholderPanel title="Schema 来源" copy={viewModel.schema.schemaSource === 'registry-api' ? '已叠加 registry config-schema 标题信息。' : '当前依赖 debug mock fixture。'} />
        <PlaceholderPanel title="当前状态" copy={`${viewModel.currentStatus.title} · ${viewModel.currentStatus.detail}`} />
        <PlaceholderPanel title="非目标" copy="不进入正式 /plugins 页面，不支持插件注入自定义前端组件。" />
      </section>

      <section style={formGridStyle}>
        <section style={cardStyle}>
          <div className="page-header">
            <p className="page-kicker">受控样例</p>
            <h2 className="page-title" style={sectionTitleStyle}>
              {viewModel.schema.pluginName}
            </h2>
            <p className="page-description">{viewModel.schema.schemaDescription}</p>
          </div>

          <section style={buttonRowStyle} aria-label="插件样例选择">
            {viewModel.plugins.map((plugin) => (
              <button
                key={plugin.id}
                onClick={() => {
                  viewModel.selectPlugin(plugin.id)
                }}
                style={plugin.id === viewModel.selectedPluginId ? primaryButtonStyle : secondaryButtonStyle}
                type="button"
              >
                {plugin.name}
              </button>
            ))}
          </section>

          <section style={fieldStackStyle}>
            {viewModel.schema.fields.map((definition) => (
              <PluginConfigField
                key={definition.path}
                definition={definition}
                issue={viewModel.issueLookup.get(definition.path)}
                onChange={viewModel.updateDraft}
                value={viewModel.draftValues[definition.path] ?? ''}
              />
            ))}
          </section>

          <section style={buttonRowStyle}>
            <button onClick={() => void viewModel.validateDraft()} style={secondaryButtonStyle} type="button">
              先做校验
            </button>
            <button onClick={() => void viewModel.saveDraft()} style={primaryButtonStyle} type="button">
              触发保存
            </button>
          </section>

          {viewModel.saveMessage ? (
            <p style={{ marginTop: 'var(--qa-spacing-md)', color: 'var(--qa-color-text-subtle)' }}>
              {viewModel.saveMessage}
            </p>
          ) : null}
        </section>

        <PluginConfigSupportMatrix supportMatrix={viewModel.schema.supportMatrix} />
      </section>
    </>
  )
}

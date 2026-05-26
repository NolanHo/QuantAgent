import { Alert, Button, Card } from '@heroui/react'

import { PageEmpty } from '@/app/components/PageEmpty'
import { PageLoading } from '@/app/components/PageLoading'
import { PlaceholderPanel } from '@/app/components/PlaceholderPanel'

import {
  buttonRowStyle,
  fieldStackStyle,
  formGridStyle,
  panelGridStyle,
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
        <Card>
          <Card.Header>
            <p className="page-kicker">受控样例</p>
            <Card.Title className="page-title" style={sectionTitleStyle}>
              {viewModel.schema.pluginName}
            </Card.Title>
            <Card.Description className="page-description">{viewModel.schema.schemaDescription}</Card.Description>
          </Card.Header>

          <Card.Content>
            <section style={buttonRowStyle} aria-label="插件样例选择">
              {viewModel.plugins.map((plugin) => (
                <Button
                  key={plugin.id}
                  onPress={() => {
                    viewModel.selectPlugin(plugin.id)
                  }}
                  size="sm"
                  type="button"
                  variant={plugin.id === viewModel.selectedPluginId ? 'primary' : 'outline'}
                >
                  {plugin.name}
                </Button>
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
              <Button onPress={() => void viewModel.validateDraft()} size="sm" type="button" variant="outline">
                先做校验
              </Button>
              <Button onPress={() => void viewModel.saveDraft()} size="sm" type="button" variant="primary">
                触发保存
              </Button>
            </section>

            {viewModel.saveMessage ? (
              <Alert status={viewModel.state === 'save-failure' ? 'danger' : 'accent'} style={{ marginTop: 'var(--qa-spacing-md)' }}>
                <Alert.Content>
                  <Alert.Description>{viewModel.saveMessage}</Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}
          </Card.Content>
        </Card>

        <PluginConfigSupportMatrix supportMatrix={viewModel.schema.supportMatrix} />
      </section>
    </>
  )
}

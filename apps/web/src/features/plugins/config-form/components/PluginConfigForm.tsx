import { Alert, Button, Card } from '@heroui/react'

import {
  buttonRowStyle,
  fieldStackStyle,
  formGridStyle,
  panelGridStyle,
  sectionTitleStyle,
} from '../lib/PluginConfigForm.styles'
import type { PluginConfigSchemaSnapshot } from '../types'
import { PluginConfigField } from './PluginConfigField'
import { PluginConfigSupportMatrix } from './PluginConfigSupportMatrix'

export type PluginConfigFormPluginOption = {
  id: string
  name: string
}

export type PluginConfigFormStatusCopy = {
  detail: string
  title: string
}

type PluginConfigFormProps = {
  actionLabel?: string
  issueLookup: Map<string, string>
  onPrimaryAction?: () => void | Promise<void>
  onSecondaryAction?: () => void | Promise<void>
  onValueChange: (path: string, nextValue: string) => void
  plugins?: PluginConfigFormPluginOption[]
  primaryActionLabel?: string
  saveMessageTone?: 'accent' | 'danger'
  saveMessage?: string | null
  schema: PluginConfigSchemaSnapshot
  secondaryActionLabel?: string
  selectedPluginId?: string
  statusCards?: Array<{ copy: string; title: string }>
  values: Record<string, string>
  onSelectPlugin?: (pluginId: string) => void
}

export function PluginConfigForm({
  actionLabel = '插件样例选择',
  issueLookup,
  onPrimaryAction,
  onSecondaryAction,
  onSelectPlugin,
  onValueChange,
  plugins = [],
  primaryActionLabel = '触发保存',
  saveMessageTone = 'accent',
  saveMessage = null,
  schema,
  secondaryActionLabel = '先做校验',
  selectedPluginId,
  statusCards = [],
  values,
}: PluginConfigFormProps) {
  return (
    <>
      {statusCards.length > 0 ? (
        <section style={panelGridStyle} aria-label="插件配置表单概览">
          {statusCards.map((card) => (
            <div key={card.title}>
              <Card>
                <Card.Header>
                  <Card.Title>{card.title}</Card.Title>
                </Card.Header>
                <Card.Content>{card.copy}</Card.Content>
              </Card>
            </div>
          ))}
        </section>
      ) : null}

      <section style={formGridStyle}>
        <Card>
          <Card.Header>
            <p className="page-kicker">受控样例</p>
            <Card.Title className="page-title" style={sectionTitleStyle}>
              {schema.pluginName}
            </Card.Title>
            <Card.Description className="page-description">{schema.schemaDescription}</Card.Description>
          </Card.Header>

          <Card.Content>
            {plugins.length > 0 && onSelectPlugin ? (
              <section style={buttonRowStyle} aria-label={actionLabel}>
                {plugins.map((plugin) => (
                  <Button
                    key={plugin.id}
                    onPress={() => {
                      onSelectPlugin(plugin.id)
                    }}
                    size="sm"
                    type="button"
                    variant={plugin.id === selectedPluginId ? 'primary' : 'outline'}
                  >
                    {plugin.name}
                  </Button>
                ))}
              </section>
            ) : null}

            <section style={fieldStackStyle}>
              {schema.fields.map((definition) => (
                <PluginConfigField
                  key={definition.path}
                  definition={definition}
                  issue={issueLookup.get(definition.path)}
                  onChange={onValueChange}
                  value={values[definition.path] ?? ''}
                />
              ))}
            </section>

            {(onSecondaryAction || onPrimaryAction) ? (
              <section style={buttonRowStyle}>
                {onSecondaryAction ? (
                  <Button onPress={() => void onSecondaryAction()} size="sm" type="button" variant="outline">
                    {secondaryActionLabel}
                  </Button>
                ) : null}
                {onPrimaryAction ? (
                  <Button onPress={() => void onPrimaryAction()} size="sm" type="button" variant="primary">
                    {primaryActionLabel}
                  </Button>
                ) : null}
              </section>
            ) : null}

            {saveMessage ? (
              <Alert status={saveMessageTone} style={{ marginTop: 'var(--qa-spacing-md)' }}>
                <Alert.Content>
                  <Alert.Description>{saveMessage}</Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}
          </Card.Content>
        </Card>

        <PluginConfigSupportMatrix supportMatrix={schema.supportMatrix} />
      </section>
    </>
  )
}

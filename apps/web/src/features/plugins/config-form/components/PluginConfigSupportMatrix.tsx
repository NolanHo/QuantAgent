import { Card, Chip } from '@heroui/react'

import {
  asideListStyle,
  supportBadgeColor,
} from '../lib/PluginConfigForm.styles'
import type { PluginConfigSchemaSnapshot } from '../types'

type PluginConfigSupportMatrixProps = {
  description?: string
  title?: string
  supportMatrix: PluginConfigSchemaSnapshot['supportMatrix']
}

export function PluginConfigSupportMatrix({
  description,
  title = '支持矩阵',
  supportMatrix,
}: PluginConfigSupportMatrixProps) {
  return (
    <Card>
      <Card.Header>
        <Card.Title>{title}</Card.Title>
        {description ? (
          <Card.Description className="page-description">{description}</Card.Description>
        ) : null}
      </Card.Header>

      <Card.Content>
        <section style={asideListStyle} aria-label="支持矩阵">
          {supportMatrix.map((entry) => (
            <Card key={entry.feature} variant="secondary">
              <Card.Header style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <strong>{entry.feature}</strong>
                <Chip color={supportBadgeColor(entry.level)} size="sm" variant="soft">
                  {entry.level}
                </Chip>
              </Card.Header>
              <Card.Content>
                <p style={{ margin: 0, color: 'var(--qa-color-text-subtle)', fontSize: '13px' }}>
                  {entry.note}
                </p>
              </Card.Content>
            </Card>
          ))}
        </section>
      </Card.Content>
    </Card>
  )
}

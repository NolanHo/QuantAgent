import { Card, Chip } from '@heroui/react'

import {
  asideListStyle,
  sectionTitleStyle,
  supportBadgeColor,
} from '../lib/PluginConfigForm.styles'
import type { PluginConfigSchemaSnapshot } from '../types'

type PluginConfigSupportMatrixProps = {
  supportMatrix: PluginConfigSchemaSnapshot['supportMatrix']
}

export function PluginConfigSupportMatrix({
  supportMatrix,
}: PluginConfigSupportMatrixProps) {
  return (
    <Card>
      <Card.Header>
        <Card.Title style={sectionTitleStyle}>Schema Inspect</Card.Title>
        <Card.Description className="page-description">
          当前视图只展示受控的 schema 摘要、支持矩阵和状态边界，不接受任意 schema playground 输入。
        </Card.Description>
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

        <section style={{ marginTop: 'var(--qa-spacing-lg)' }}>
          <h3 style={{ margin: 0, fontSize: '16px' }}>调试态状态机</h3>
          <ul style={{ margin: '10px 0 0', paddingInlineStart: '20px', color: 'var(--qa-color-text-subtle)' }}>
            <li>加载中 / 空状态：用于验证 schema 与 config 入口状态。</li>
            <li>校验失败：字段级错误由表单 UI 明确承接。</li>
            <li>保存中 / 保存成功 / 保存失败：不依赖正式业务接口即可验证保存反馈。</li>
          </ul>
        </section>
      </Card.Content>
    </Card>
  )
}

import {
  asideListStyle,
  cardStyle,
  sectionTitleStyle,
  supportBadgeStyle,
} from './PluginConfigDebug.styles'
import type { PluginConfigSchemaSnapshot } from './types'

type PluginConfigSupportMatrixProps = {
  supportMatrix: PluginConfigSchemaSnapshot['supportMatrix']
}

export function PluginConfigSupportMatrix({
  supportMatrix,
}: PluginConfigSupportMatrixProps) {
  return (
    <aside style={cardStyle}>
      <h2 style={sectionTitleStyle}>Schema Inspect</h2>
      <p className="page-description">
        当前视图只展示受控的 schema 摘要、支持矩阵和状态边界，不接受任意 schema playground 输入。
      </p>

      <section style={asideListStyle} aria-label="支持矩阵">
        {supportMatrix.map((entry) => (
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
  )
}

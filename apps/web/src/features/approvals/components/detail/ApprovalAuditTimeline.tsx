import { Card } from '@heroui/react'

import type { ApprovalWorkbenchItem } from '../../types/approval-workbench.types'

export function ApprovalAuditTimeline({ approval }: { approval: ApprovalWorkbenchItem }) {
  const entries = [
    ['审批创建', '系统根据高风险建议生成 ApprovalRequest，并写入到期策略。'],
    ['等待确认', `当前状态：${approval.status}`],
    ['后续动作', '后续处理以后端记录为准。'],
  ] as const

  return (
    <Card className="border border-hairline bg-canvas">
      <div className="grid gap-3 p-4">
        <div className="grid gap-1">
          <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.04em] text-info">
            处理历史
          </p>
          <h2 className="m-0 text-title-sm font-bold text-ink">时间线</h2>
        </div>
        <div className="grid gap-3">
          {entries.map(([title, copy]) => (
            <article key={title} className="grid gap-1.5 border-l-2 border-hairline-strong pl-3.5">
              <p className="m-0 text-[12px] font-bold text-muted">{title}</p>
              <p className="m-0 text-body-sm text-muted">{copy}</p>
            </article>
          ))}
        </div>
      </div>
    </Card>
  )
}

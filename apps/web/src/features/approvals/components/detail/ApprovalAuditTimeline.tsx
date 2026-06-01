import { Card } from '@heroui/react'

import type { ApprovalWorkbenchItem } from '../../types/approval-workbench.types'

export function ApprovalAuditTimeline({ approval }: { approval: ApprovalWorkbenchItem }) {
  const entries = [
    ['审批创建', '系统根据高风险建议生成 ApprovalRequest，并写入到期策略。'],
    ['等待确认', `当前请求状态：${approval.status}。若为高风险 increase_risk，将保留更强确认提示。`],
    ['后续动作', 'approve、reject、request_reanalysis 的真实审计以后端真源为准。'],
  ] as const

  return (
    <Card className="border border-hairline bg-canvas">
      <div className="grid gap-3 p-4">
        <div className="grid gap-1">
          <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[rgb(3,105,161)]">
            处理历史
          </p>
          <h2 className="m-0 text-title-sm font-bold text-ink">
            保留人工动作和修改前后摘要
          </h2>
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

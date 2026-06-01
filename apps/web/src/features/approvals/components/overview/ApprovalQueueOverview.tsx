import { Card } from '@heroui/react'

import type { ApprovalWorkbenchOverview } from '../../types/approval-workbench.types'

export function ApprovalQueueOverview({ overview }: { overview: ApprovalWorkbenchOverview }) {
  const metrics = [
    { label: '待处理', value: String(overview.pendingCount), description: '当前仍需人工确认的审批项' },
    { label: '即将过期', value: String(overview.expiringSoonCount), description: '需要优先复核时效的审批项' },
    { label: '高风险', value: String(overview.highRiskCount), description: '风险方向偏高的审批请求' },
    { label: '强确认', value: String(overview.strongConfirmationCount), description: '需要更强确认入口的审批项' },
  ] as const

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.label} className="border border-hairline bg-surface-soft/80">
          <div className="grid gap-1 p-4">
            <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[rgb(3,105,161)]">
              {metric.label}
            </p>
            <p className="m-0 text-[24px] font-bold text-ink">{metric.value}</p>
            <p className="m-0 text-[12px] text-muted">{metric.description}</p>
          </div>
        </Card>
      ))}
    </section>
  )
}

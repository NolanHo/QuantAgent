import { Card } from '@heroui/react'

import type { ApprovalWorkbenchOverview } from '../../types/approval-workbench.types'

export function ApprovalQueueOverview({ overview }: { overview: ApprovalWorkbenchOverview }) {
  const metrics = [
    { label: '待处理', value: String(overview.pendingCount) },
    { label: '即将过期', value: String(overview.expiringSoonCount) },
    { label: '高风险', value: String(overview.highRiskCount) },
    { label: '强确认', value: String(overview.strongConfirmationCount) },
  ] as const

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.label} className="border border-hairline bg-surface-soft/80">
          <div className="grid gap-0.5 p-4">
            <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.04em] text-info">
              {metric.label}
            </p>
            <p className="m-0 text-[24px] font-bold text-ink">{metric.value}</p>
          </div>
        </Card>
      ))}
    </section>
  )
}

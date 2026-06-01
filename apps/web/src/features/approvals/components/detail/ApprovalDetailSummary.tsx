import { Card } from '@heroui/react'

import type { ApprovalWorkbenchItem } from '../../types/approval-workbench.types'
import {
  formatConfirmationLabel,
  formatExpirationActionLabel,
  formatRiskDirectionLabel,
} from '../../utils/approval-formatters'

export function ApprovalDetailSummary({ approval }: { approval: ApprovalWorkbenchItem }) {
  const rows = [
    `Approval ID：${approval.id}`,
    `关联事件：${approval.eventTitle}`,
    `来源：${approval.source}`,
    `推荐度：${approval.recommendationLabel}`,
    `事件可信度：${approval.eventCredibility}`,
    `分析置信度：${approval.analysisConfidence}`,
    `风险方向：${formatRiskDirectionLabel(approval.riskDirection)}`,
    `风险等级：${approval.riskLevel}`,
    `确认等级：${formatConfirmationLabel(approval.confirmationLevel)}`,
    `到期时间：${approval.expiresAtLabel} · ${approval.expiresInLabel}`,
    `到期策略：${formatExpirationActionLabel(approval.expirationAction)}`,
    `触发摘要：${approval.triggerSummary}`,
  ] as const

  return (
    <Card className="border border-hairline bg-canvas">
      <div className="grid gap-3 p-4">
        <div className="grid gap-1">
          <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[rgb(3,105,161)]">
            审批上下文
          </p>
          <h2 className="m-0 text-title-sm font-bold text-ink">
            事件、建议、风险方向和证据摘要
          </h2>
        </div>

        <div className="grid gap-2">
          {rows.map((row) => (
            <p key={row} className="m-0 text-body-sm text-muted">
              {row}
            </p>
          ))}
        </div>
      </div>
    </Card>
  )
}

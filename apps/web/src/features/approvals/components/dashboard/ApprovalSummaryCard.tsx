import { Card } from '@heroui/react'

import type { ApprovalWorkbenchItem } from '../../types/approval-workbench.types'
import { ApprovalConfirmationBadge, ApprovalRiskBadge } from '../shared/ApprovalBadge'
import { ApprovalLinkButton } from '../shared/ApprovalLinkButton'

export function ApprovalSummaryCard({ approval }: { approval: ApprovalWorkbenchItem }) {
  return (
    <Card className="border border-hairline bg-surface-soft/80">
      <div className="grid gap-3 p-4">
        <div className="flex flex-wrap gap-2">
          <ApprovalRiskBadge approval={approval} />
          <ApprovalConfirmationBadge confirmationLevel={approval.confirmationLevel} />
        </div>
        <div className="grid gap-1">
          <h3 className="m-0 text-title-sm font-bold text-ink">{approval.actionLabel}</h3>
          <p className="m-0 text-body-sm text-muted">
            {approval.eventTitle} · 推荐度 {approval.recommendationLabel} · {approval.expiresInLabel}
          </p>
          <p className="m-0 text-body-sm text-muted">
            事件可信度 {approval.eventCredibility} · 分析置信度 {approval.analysisConfidence}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ApprovalLinkButton to="/approvals/$approvalId" params={{ approvalId: approval.id }}>
            查看审批
          </ApprovalLinkButton>
          <ApprovalLinkButton to="/events/$eventId" params={{ eventId: approval.eventId }} variant="outline">
            查看事件
          </ApprovalLinkButton>
        </div>
      </div>
    </Card>
  )
}

import { Button, Card } from '@heroui/react'

import type { ApprovalWorkbenchItem } from '../../types/approval-workbench.types'
import { formatExpirationActionLabel } from '../../utils/approval-formatters'
import {
  ApprovalConfirmationBadge,
  ApprovalRiskBadge,
  ApprovalStatusBadge,
} from '../shared/ApprovalBadge'
import { ApprovalLinkButton } from '../shared/ApprovalLinkButton'

export function ApprovalListCard({
  approval,
  isSelected,
  onOpenApprove,
  onOpenReject,
  onOpenReanalysis,
  onToggleSelected,
}: {
  approval: ApprovalWorkbenchItem
  isSelected: boolean
  onOpenApprove: (approval: ApprovalWorkbenchItem) => void
  onOpenReject: (approval: ApprovalWorkbenchItem) => void
  onOpenReanalysis: (approval: ApprovalWorkbenchItem) => void
  onToggleSelected: (approvalId: string) => void
}) {
  const actionDisabled = approval.status !== 'pending'

  return (
    <Card className="border border-hairline bg-surface-soft/80">
      <div className="grid gap-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-2">
            <div className="flex flex-wrap gap-2">
              <ApprovalStatusBadge status={approval.status} />
              <ApprovalRiskBadge approval={approval} />
              <ApprovalConfirmationBadge confirmationLevel={approval.confirmationLevel} />
            </div>
            <div className="grid gap-1">
              <h3 className="m-0 text-title-sm font-bold text-ink">{approval.actionLabel}</h3>
              <p className="m-0 text-body-sm text-muted">
                {approval.eventTitle} · {approval.source}
              </p>
            </div>
          </div>

          <label className="inline-flex items-center gap-2 rounded-lg border border-hairline bg-canvas px-3 py-2 text-[13px] text-muted">
            <input
              checked={isSelected}
              disabled={actionDisabled}
              type="checkbox"
              onChange={() => onToggleSelected(approval.id)}
            />
            加入批量处理
          </label>
        </div>

        <div className="grid gap-2 text-body-sm text-muted lg:grid-cols-2">
          <p className="m-0">推荐度：{approval.recommendationLabel}</p>
          <p className="m-0">事件可信度：{approval.eventCredibility}</p>
          <p className="m-0">分析置信度：{approval.analysisConfidence}</p>
          <p className="m-0">到期策略：{formatExpirationActionLabel(approval.expirationAction)}</p>
          <p className="m-0">到期时间：{approval.expiresAtLabel} · {approval.expiresInLabel}</p>
          <p className="m-0">触发摘要：{approval.triggerSummary}</p>
        </div>

        {approval.batchBlockReason ? (
          <div className="rounded-lg border border-hairline bg-canvas px-3 py-2 text-[12px] text-muted">
            当前不可进入批量处理：{approval.batchBlockReason}
          </div>
        ) : null}

        {approval.actionError ? (
          <div className="rounded-lg border border-trading-down/25 bg-trading-down/5 px-3 py-2 text-[12px] text-trading-down">
            {approval.actionError.message} · request_id：{approval.actionError.requestId} · trace_id：{approval.actionError.traceId}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button isDisabled={actionDisabled} size="sm" variant="primary" onPress={() => onOpenApprove(approval)}>
            批准
          </Button>
          <Button isDisabled={actionDisabled} size="sm" variant="danger-soft" onPress={() => onOpenReject(approval)}>
            拒绝
          </Button>
          <Button isDisabled={actionDisabled} size="sm" variant="outline" onPress={() => onOpenReanalysis(approval)}>
            请求重分析
          </Button>
          <ApprovalLinkButton to="/approvals/$approvalId" params={{ approvalId: approval.id }} variant="outline">
            查看审批详情
          </ApprovalLinkButton>
          <ApprovalLinkButton to="/events/$eventId" params={{ eventId: approval.eventId }} variant="outline">
            查看关联事件
          </ApprovalLinkButton>
        </div>
      </div>
    </Card>
  )
}

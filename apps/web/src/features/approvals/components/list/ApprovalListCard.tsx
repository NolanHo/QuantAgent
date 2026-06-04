import { Button, Card } from '@heroui/react'
import { Check, Plus } from 'lucide-react'

import type { ApprovalWorkbenchItem } from '../../types/approval-workbench.types'
import {
  maskApprovalTraceIdentifier,
  toSafeApprovalErrorMessage,
} from '../../utils/approval-error-display'
import { formatExpirationActionLabel } from '../../utils/approval-formatters'
import { ApprovalActionButton } from '../shared/ApprovalActionButton'
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
  const actionError = approval.actionError

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

          <Button
            isIconOnly
            aria-label={isSelected ? '移出批量处理' : '加入批量处理'}
            className={isSelected ? 'bg-info text-white hover:bg-info/90' : 'text-info'}
            isDisabled={actionDisabled}
            size="sm"
            type="button"
            variant={isSelected ? 'primary' : 'outline'}
            onPress={() => onToggleSelected(approval.id)}
          >
            {isSelected ? <Check size={16} /> : <Plus size={16} />}
          </Button>
        </div>

        <div className="grid gap-2 text-body-sm text-muted lg:grid-cols-2">
          <p className="m-0">推荐度：{approval.recommendationLabel}</p>
          <p className="m-0">到期策略：{formatExpirationActionLabel(approval.expirationAction)}</p>
          <p className="m-0">到期时间：{approval.expiresAtLabel} · {approval.expiresInLabel}</p>
          <p className="m-0">可信度：{approval.eventCredibility} · 分析置信度：{approval.analysisConfidence}</p>
          <p className="m-0">触发摘要：{approval.triggerSummary}</p>
        </div>

        {approval.batchBlockReason ? (
          <div className="rounded-lg border border-hairline bg-canvas px-3 py-2 text-[12px] text-muted">
            当前不可进入批量处理：{approval.batchBlockReason}
          </div>
        ) : null}

        {actionError ? (
          <div className="rounded-lg border border-trading-down/25 bg-trading-down/5 px-3 py-2 text-[12px] text-trading-down">
            {toSafeApprovalErrorMessage(actionError.message)} · request_id：
            {maskApprovalTraceIdentifier(actionError.requestId)} · trace_id：
            {maskApprovalTraceIdentifier(actionError.traceId)}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <ApprovalActionButton isDisabled={actionDisabled} type="approve" onPress={() => onOpenApprove(approval)} />
          <ApprovalActionButton isDisabled={actionDisabled} type="reject" onPress={() => onOpenReject(approval)} />
          <ApprovalActionButton isDisabled={actionDisabled} type="request_reanalysis" onPress={() => onOpenReanalysis(approval)} />
          <ApprovalLinkButton to="/approvals/$approvalId" params={{ approvalId: approval.id }} variant="ghost">
            查看审批详情
          </ApprovalLinkButton>
          <ApprovalLinkButton to="/events/$eventId" params={{ eventId: approval.eventId }} variant="ghost">
            查看关联事件
          </ApprovalLinkButton>
        </div>
      </div>
    </Card>
  )
}

import { Chip } from '@heroui/react'

import type { ApprovalWorkbenchItem } from '../../types/approval-workbench.types'
import {
  formatConfirmationLabel,
  formatRiskDirectionLabel,
  formatStatusLabel,
} from '../../utils/approval-formatters'

export function ApprovalStatusBadge({ status }: { status: ApprovalWorkbenchItem['status'] }) {
  const color = status === 'approved'
    ? 'success'
    : status === 'rejected' || status === 'expired'
      ? 'danger'
      : status === 'reanalysis_requested'
        ? 'warning'
        : 'accent'

  return (
    <Chip color={color} size="sm" variant="soft">
      {formatStatusLabel(status)}
    </Chip>
  )
}

export function ApprovalRiskBadge({ approval }: { approval: ApprovalWorkbenchItem }) {
  return (
    <Chip color={approval.riskLevel === '高' ? 'danger' : approval.riskLevel === '中' ? 'warning' : 'success'} size="sm" variant="soft">
      {formatRiskDirectionLabel(approval.riskDirection)} · {approval.riskLevel}
    </Chip>
  )
}

export function ApprovalConfirmationBadge({
  confirmationLevel,
}: {
  confirmationLevel: ApprovalWorkbenchItem['confirmationLevel']
}) {
  return (
    <Chip size="sm" variant="soft">
      {formatConfirmationLabel(confirmationLevel)}
    </Chip>
  )
}

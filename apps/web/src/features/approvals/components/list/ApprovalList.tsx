import type { ApprovalWorkbenchItem } from '../../types/approval-workbench.types'
import { ApprovalEmptyState } from '../states/ApprovalEmptyState'
import { ApprovalListCard } from './ApprovalListCard'

export function ApprovalList({
  items,
  onOpenApprove,
  onOpenReject,
  onOpenReanalysis,
  onToggleSelected,
  selectedIds,
}: {
  items: readonly ApprovalWorkbenchItem[]
  onOpenApprove: (approval: ApprovalWorkbenchItem) => void
  onOpenReject: (approval: ApprovalWorkbenchItem) => void
  onOpenReanalysis: (approval: ApprovalWorkbenchItem) => void
  onToggleSelected: (approvalId: string) => void
  selectedIds: readonly string[]
}) {
  if (items.length === 0) {
    return <ApprovalEmptyState />
  }

  return (
    <section className="grid gap-3">
      {items.map((approval) => (
        <ApprovalListCard
          key={approval.id}
          approval={approval}
          isSelected={selectedIds.includes(approval.id)}
          onOpenApprove={onOpenApprove}
          onOpenReject={onOpenReject}
          onOpenReanalysis={onOpenReanalysis}
          onToggleSelected={onToggleSelected}
        />
      ))}
    </section>
  )
}

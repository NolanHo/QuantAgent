import { Card } from '@heroui/react'

import type { ApprovalBatchEligibility } from '../../types/approval-workbench.types'
import { ApprovalActionButton } from '../shared/ApprovalActionButton'

export function ApprovalBatchActionPanel({
  eligibility,
  selectedCount,
}: {
  eligibility: ApprovalBatchEligibility
  selectedCount: number
}) {
  return (
    <Card className="border border-hairline bg-canvas">
      <div className="grid gap-3 p-4">
        <div className="grid gap-1">
          <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.04em] text-info">
            批量处理
          </p>
          <h2 className="m-0 text-title-sm font-bold text-ink">首版保持只读</h2>
          <p className="m-0 text-body-sm text-muted">
            已选 {selectedCount} 项，可满足同类资格 {eligibility.eligibleIds.length} 项。
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ApprovalActionButton isDisabled type="approve" variant="ghost" />
          <ApprovalActionButton isDisabled type="reject" variant="ghost" />
          <ApprovalActionButton isDisabled type="request_reanalysis" variant="ghost" />
        </div>

        <div className="rounded-lg border border-hairline bg-surface-soft px-3 py-3 text-[12px] text-muted">
          仅统计相同风险方向、相同确认等级、非 `manual_only` 且未临近到期的项目。
        </div>

        {eligibility.issues.length > 0 ? (
          <div className="grid gap-2 rounded-lg border border-hairline bg-surface-soft px-3 py-3">
            <p className="m-0 text-[12px] font-bold text-muted-strong">不可批量原因</p>
            {eligibility.issues.map((issue) => (
              <p key={`${issue.approvalId}-${issue.reason}`} className="m-0 text-[12px] text-muted">
                {issue.approvalId}：{issue.reason}
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  )
}

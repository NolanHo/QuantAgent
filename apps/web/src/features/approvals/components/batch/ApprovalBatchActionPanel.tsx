import { Button, Card } from '@heroui/react'

import type { ApprovalBatchEligibility } from '../../types/approval-workbench.types'

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
            受限批量处理
          </p>
          <h2 className="m-0 text-title-sm font-bold text-ink">
            批量处理比逐条处理更保守
          </h2>
          <p className="m-0 text-body-sm text-muted">
            当前已选 {selectedCount} 项，未来可能满足同类批量资格的有 {eligibility.eligibleIds.length} 项。首版只保留边界说明与禁入条件，不提供可执行的批量 approve / reject / request_reanalysis。
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button isDisabled size="sm" variant="primary">
            批量批准
          </Button>
          <Button isDisabled size="sm" variant="danger-soft">
            批量拒绝
          </Button>
          <Button isDisabled size="sm" variant="outline">
            批量请求重分析
          </Button>
        </div>

        <div className="rounded-lg border border-hairline bg-surface-soft px-3 py-3 text-[12px] text-muted">
          批量资格仍以相同风险方向、相同确认等级、非 `manual_only`、未过期、非即将自动过期为前提；在真实批量 contract 和审计规则单独评审前，这里不会触发任何动作。
        </div>

        {eligibility.issues.length > 0 ? (
          <div className="grid gap-2 rounded-lg border border-hairline bg-surface-soft px-3 py-3">
            <p className="m-0 text-[12px] font-bold text-muted-strong">当前不可批量处理的原因</p>
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

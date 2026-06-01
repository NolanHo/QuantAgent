import { Card } from '@heroui/react'

import { PageLoading } from '../../../../app/components/PageLoading'
import { useApprovalWorkbenchDetailQuery } from '../../queries/use-approval-workbench-detail'
import { ApprovalAuditTimeline } from '../detail/ApprovalAuditTimeline'
import { ApprovalDetailSummary } from '../detail/ApprovalDetailSummary'
import { ApprovalPageHeader } from '../shared/ApprovalPageHeader'
import { ApprovalLinkButton } from '../shared/ApprovalLinkButton'

export function ApprovalDetailPage({ approvalId }: { approvalId: string }) {
  const approvalQuery = useApprovalWorkbenchDetailQuery(approvalId)
  const approval = approvalQuery.data

  if (approvalQuery.isLoading) {
    return <PageLoading message="正在加载审批详情..." />
  }

  if (!approval) {
    return (
      <div className="grid gap-5">
        <ApprovalPageHeader
          kicker="审批详情"
          title="未找到审批项"
          description="当前审批 ID 不存在或尚未同步到前端工作台。"
        />
      </div>
    )
  }

  return (
    <div className="grid gap-5">
      <ApprovalPageHeader
        kicker="审批详情"
        title={approval.actionLabel}
        description="审批详情负责完整上下文页：展示确认等级、到期策略和回跳入口，但不把批准写成已下单或已成交。"
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.92fr)]">
        <ApprovalDetailSummary approval={approval} />

        <Card className="border border-hairline bg-canvas">
          <div className="grid gap-3 p-4">
            <div className="grid gap-1">
              <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.04em] text-info">
                动作入口
              </p>
              <h2 className="m-0 text-title-sm font-bold text-ink">
                审批详情只做复核和跳转，不伪造成功状态
              </h2>
            </div>
            <p className="m-0 text-body-sm text-muted">
              increase_risk 默认需要更强确认；manual_only 不能通过弱确认入口绕过。`amend` 仍依赖后端 payload contract、前后差异摘要和审计写入，本轮只固定边界，不伪造提交成功。真实动作失败时，反馈应包含 request_id / trace_id。
            </p>
            <div className="flex flex-wrap gap-2">
              <ApprovalLinkButton to="/events/$eventId" params={{ eventId: approval.eventId }} variant="outline">
                查看关联事件
              </ApprovalLinkButton>
              <ApprovalLinkButton to="/events/$eventId/audit" params={{ eventId: approval.eventId }} variant="outline">
                查看事件审计
              </ApprovalLinkButton>
              <ApprovalLinkButton to="/runtime" variant="outline">
                查看 Runtime 摘要
              </ApprovalLinkButton>
              <ApprovalLinkButton to="/approvals" variant="outline">
                返回审批工作台
              </ApprovalLinkButton>
              <ApprovalLinkButton to="/approval-link/$token" params={{ token: 'preview-token' }} variant="outline">
                预览授权页
              </ApprovalLinkButton>
            </div>
            <div className="rounded-lg border border-hairline bg-surface-soft px-3 py-3 text-[12px] text-muted">
              动作边界：`approve` / `reject` / `request_reanalysis` 维持首版受控交互；`amend` 需要更细的 Approval DTO、payload diff 和审计 contract，后续单独评审后再进入可执行实现。
            </div>
          </div>
        </Card>
      </div>

      <ApprovalAuditTimeline approval={approval} />
    </div>
  )
}

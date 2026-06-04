import { Card } from '@heroui/react'

import { PageLoading } from '../../../../app/components/PageLoading'
import { useApprovalWorkbenchDetailQuery } from '../../queries/use-approval-workbench-detail'
import { ApprovalAuditTimeline } from '../detail/ApprovalAuditTimeline'
import { ApprovalDetailSummary } from '../detail/ApprovalDetailSummary'
import { ApprovalPageHeader } from '../shared/ApprovalPageHeader'
import { ApprovalLinkButton } from '../shared/ApprovalLinkButton'

const RELATED_LINK_CLASS_NAME =
  'group h-auto w-full flex-col items-start justify-center gap-1 rounded-2xl border border-hairline bg-surface-soft/70 px-4 py-3 text-left text-body-sm font-semibold text-muted-strong transition-[transform,border-color,background-color,color,box-shadow] duration-150 hover:scale-[1.015] hover:border-info/35 hover:bg-white hover:text-ink hover:shadow-sm'

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
        description="查看当前审批项、关联入口和处理记录。"
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.92fr)]">
        <ApprovalDetailSummary approval={approval} />

        <Card className="border border-hairline bg-canvas">
          <div className="grid gap-3 p-4">
            <div className="grid gap-1">
              <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.04em] text-info">
                相关入口
              </p>
              <h2 className="m-0 text-title-sm font-bold text-ink">按入口类型逐项跳转</h2>
            </div>
            <div className="grid gap-2">
              <ApprovalLinkButton
                className={RELATED_LINK_CLASS_NAME}
                params={{ eventId: approval.eventId }}
                to="/events/$eventId"
                variant="ghost"
              >
                <span>查看关联事件</span>
                <span className="text-[12px] font-medium text-muted transition-colors group-hover:text-info">事件快照与决策上下文</span>
              </ApprovalLinkButton>
              <ApprovalLinkButton
                className={RELATED_LINK_CLASS_NAME}
                params={{ eventId: approval.eventId }}
                to="/events/$eventId/audit"
                variant="ghost"
              >
                <span>查看事件审计</span>
                <span className="text-[12px] font-medium text-muted transition-colors group-hover:text-info">审计节点与回溯记录</span>
              </ApprovalLinkButton>
              <ApprovalLinkButton className={RELATED_LINK_CLASS_NAME} to="/runtime" variant="ghost">
                <span>查看 Runtime 摘要</span>
                <span className="text-[12px] font-medium text-muted transition-colors group-hover:text-info">运行态概览与异常入口</span>
              </ApprovalLinkButton>
              <ApprovalLinkButton className={RELATED_LINK_CLASS_NAME} to="/approvals" variant="ghost">
                <span>返回审批工作台</span>
                <span className="text-[12px] font-medium text-muted transition-colors group-hover:text-info">继续处理其他待审批项</span>
              </ApprovalLinkButton>
              <ApprovalLinkButton
                className={RELATED_LINK_CLASS_NAME}
                params={{ token: 'preview-token' }}
                to="/approval-link/$token"
                variant="ghost"
              >
                <span>预览授权页</span>
                <span className="text-[12px] font-medium text-muted transition-colors group-hover:text-info">查看公开确认入口效果</span>
              </ApprovalLinkButton>
            </div>
          </div>
        </Card>
      </div>

      <ApprovalAuditTimeline approval={approval} />
    </div>
  )
}

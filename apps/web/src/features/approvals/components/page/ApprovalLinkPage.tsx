import { Button, Card } from '@heroui/react'

import { PageLoading } from '../../../../app/components/PageLoading'
import { useApprovalLinkContextQuery } from '../../queries/use-approval-link-context'
import { formatConfirmationLabel, formatExpirationActionLabel, formatRiskDirectionLabel } from '../../utils/approval-formatters'
import { ApprovalPageHeader } from '../shared/ApprovalPageHeader'
import { ApprovalLinkButton } from '../shared/ApprovalLinkButton'

function maskToken(token: string) {
  if (token.length <= 8) {
    return '•'.repeat(token.length)
  }
  return `${token.slice(0, 4)}••••${token.slice(-4)}`
}

export function ApprovalLinkPage({ token }: { token: string }) {
  const contextQuery = useApprovalLinkContextQuery(token)
  const context = contextQuery.data
  const statusLabelMap = {
    valid: '可用',
    near_expiry: '即将过期',
    expired: '已过期',
    used: '已使用',
    invalid: '无效',
    permission_mismatch: '需要更强确认',
  } as const

  if (contextQuery.isLoading || !context) {
    return <PageLoading message="正在加载授权上下文..." />
  }

  const canOpenContext = context.approvalId !== 'unknown' && context.eventId !== 'unknown'

  return (
    <div className="grid gap-5">
      <ApprovalPageHeader
        kicker="一次性授权"
        title="Approval Link"
        description="独立于后台壳之外的受限确认入口。token 校验和短期上下文以后端真源为准，首版只固定语义和返回路径。"
      />

      <Card className="border border-hairline bg-canvas">
        <div className="grid gap-4 p-4">
          <div className="grid gap-1">
            <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[rgb(3,105,161)]">
              Link Confirm
            </p>
            <h2 className="m-0 text-title-sm font-bold text-ink">
              受限入口只暴露最小上下文，不绕过强确认
            </h2>
          </div>

          <div className="grid gap-2 text-body-sm text-muted">
            <p className="m-0">token 摘要：{maskToken(token)}</p>
            <p className="m-0">状态：{statusLabelMap[context.status]}</p>
            <p className="m-0">审批项：{context.actionLabel}</p>
            <p className="m-0">关联事件：{context.eventTitle}</p>
            <p className="m-0">风险方向：{formatRiskDirectionLabel(context.riskDirection)}</p>
            <p className="m-0">风险等级：{context.riskLevel}</p>
            <p className="m-0">确认等级：{formatConfirmationLabel(context.confirmationLevel)}</p>
            <p className="m-0">到期策略：{formatExpirationActionLabel(context.expirationAction)}</p>
            <p className="m-0">剩余时间：{context.expiresInLabel}</p>
            <p className="m-0">触发摘要：{context.triggerSummary}</p>
            <p className="m-0">审计请求：{context.requestId}</p>
          </div>

          {context.disabledReason ? (
            <div className="rounded-lg border border-hairline bg-surface-soft px-3 py-3 text-[12px] text-muted">
              {context.disabledReason}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button isDisabled={context.actionDisabled} size="sm" variant="primary">
              受限批准
            </Button>
            <Button isDisabled={context.actionDisabled} size="sm" variant="danger-soft">
              受限拒绝
            </Button>
            {canOpenContext ? (
              <>
                <ApprovalLinkButton to="/approvals/$approvalId" params={{ approvalId: context.approvalId }} variant="outline">
                  打开后台审批详情
                </ApprovalLinkButton>
                <ApprovalLinkButton to="/events/$eventId" params={{ eventId: context.eventId }} variant="outline">
                  查看关联事件
                </ApprovalLinkButton>
              </>
            ) : (
              <ApprovalLinkButton to="/login" variant="outline">
                返回登录
              </ApprovalLinkButton>
            )}
            <ApprovalLinkButton to="/approvals" variant="outline">
              返回审批工作台
            </ApprovalLinkButton>
          </div>
        </div>
      </Card>
    </div>
  )
}

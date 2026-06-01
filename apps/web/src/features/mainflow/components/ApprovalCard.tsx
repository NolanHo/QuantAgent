import {
  Card,
  Chip,
} from '@heroui/react'

import type { ApprovalSummary } from '../mock-data'
import { LinkButton } from './LinkButton'

export function ApprovalCard({ approval }: { approval: ApprovalSummary }) {
  return (
    <Card className="border border-hairline bg-surface-soft/80">
      <div className="flex flex-wrap gap-2 p-4 pb-0">
        <Chip size="sm" variant="soft">{approval.riskDirection}</Chip>
        <Chip size="sm" variant="soft">{approval.riskLevel}</Chip>
        <Chip size="sm" variant="soft">{approval.confirmationLevel}</Chip>
      </div>
      <div className="grid gap-2 p-4">
        <h3 className="m-0 text-title-sm font-bold text-ink">{approval.actionLabel}</h3>
        <p className="m-0 text-body-sm text-muted">
          {approval.eventTitle} · 建议推荐度 {approval.recommendation} · {approval.expiresIn}
        </p>
        <p className="m-0 text-body-sm text-muted">
          事件可信度 {approval.eventCredibility} · 分析置信度 {approval.analysisConfidence} · 到期策略 {approval.expirationAction}
        </p>
        <p className="m-0 text-body-sm text-muted">{approval.triggerSummary}</p>
      </div>
      <div className="flex flex-wrap gap-2 p-4 pt-0">
        <LinkButton to="/approvals/$approvalId" params={{ approvalId: approval.id }}>
          查看审批
        </LinkButton>
        <LinkButton to="/events/$eventId" params={{ eventId: approval.eventId }} variant="outline">
          查看事件
        </LinkButton>
        <LinkButton to="/approvals" variant="outline">
          回到审批队列
        </LinkButton>
      </div>
    </Card>
  )
}

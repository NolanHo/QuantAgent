import {
  DetailFacts,
  LinkButton,
  PageHeader,
  PageSectionCard,
  SectionHeader,
} from '@/shared/ui'

import { useEventAuditPage } from '../../hooks/use-event-detail-page'

function EventAuditNotFoundState() {
  return (
    <div className="grid gap-5">
      <PageHeader
        kicker="事件级审计"
        title="事件不存在"
        description="当前事件编号没有匹配到演示数据，请返回事件中心重新选择。"
      />
      <PageSectionCard>
        <SectionHeader
          eyebrow="未找到"
          title="当前事件已移除或编号无效"
          description="审计页也不做静默兜底，避免回放到错误事件链路。"
        />
        <div className="flex flex-wrap gap-2">
          <LinkButton to="/events" variant="outline">返回事件中心</LinkButton>
        </div>
      </PageSectionCard>
    </div>
  )
}

export function EventAuditPageContent({ eventId }: { eventId: string }) {
  const audit = useEventAuditPage(eventId)

  if (!audit.found || !audit.model) {
    return <EventAuditNotFoundState />
  }

  const {
    event,
    relatedApproval,
    relatedRun,
    summary,
    timeline,
  } = audit.model

  return (
    <div className="grid gap-5">
      <PageHeader
        kicker="事件级审计"
        title="事件时间线"
        description="回放建议生成、重分析和人工动作。"
      />

      <PageSectionCard>
        <SectionHeader
          eyebrow="当前事件摘要"
          title={event.title}
          description="可信度、影响强度、当前状态和关联链路。"
        />
        <DetailFacts
          rows={[
            `事件可信度：${summary.eventReliability} / 100`,
            `行业影响强度：${summary.impactStrength} / 100`,
            `当前状态：${summary.status}`,
            `关联审批：${summary.approvalId ?? '暂无'}`,
            `关联运行：${summary.runId ?? '暂无'}`,
          ]}
        />
      </PageSectionCard>

      <PageSectionCard>
        <SectionHeader
          eyebrow="时间线节点"
          title={`事件 ${event.id} 的关键节点`}
          description="事件状态、行业分析、审批请求和重分析记录。"
        />
        <div className="grid gap-3">
          {timeline.map((item) => (
            <article key={`${item.title}-${item.copy}`} className="grid gap-1.5 border-l-2 border-hairline-strong pl-3.5">
              <p className="m-0 text-[12px] font-bold text-muted">{item.title}</p>
              <p className="m-0 text-body-sm text-muted">{item.copy}</p>
            </article>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {relatedRun ? (
            <LinkButton to="/runtime/agents/$runId" params={{ runId: relatedRun.id }} variant="outline">
              查看运行详情
            </LinkButton>
          ) : null}
          {relatedApproval ? (
            <LinkButton to="/approvals/$approvalId" params={{ approvalId: relatedApproval.id }} variant="outline">
              查看审批详情
            </LinkButton>
          ) : null}
        </div>
      </PageSectionCard>
    </div>
  )
}

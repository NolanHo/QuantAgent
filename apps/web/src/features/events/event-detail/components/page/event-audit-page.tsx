import { LinkButton } from '@/shared/ui'

import { PageSectionCard } from '@/features/mainflow/components/PageSectionCard'
import { SectionHeader } from '@/features/mainflow/components/SectionHeader'
import {
  DetailFacts,
  PageHeader,
} from '@/features/mainflow/pages/shared'

import { useEventAuditPage } from '../../hooks/use-event-detail-page'

function EventAuditNotFoundState() {
  return (
    <div className="grid gap-5">
      <PageHeader
        kicker="事件级审计"
        title="事件不存在"
        description="当前事件 ID 没有匹配到 mock 数据，请返回事件中心重新选择。"
      />
      <PageSectionCard>
        <SectionHeader
          eyebrow="未找到"
          title="当前事件已移除或 ID 无效"
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
  } = audit.model

  return (
    <div className="grid gap-5">
      <PageHeader
        kicker="事件级审计"
        title="事件时间线"
        description="按事件回放建议生成、重分析和人工动作。这里只做时间线骨架，不发明新的审计 contract。"
      />

      <PageSectionCard>
        <SectionHeader
          eyebrow="当前事件摘要"
          title={event.title}
          description="时间线围绕事件而不是围绕全局日志组织，让用户能顺着主线回放建议如何变成现在这样。"
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
          description="建议变更节点、重分析节点和人工动作节点都需要能跳回相关详情页。"
        />
        <div className="grid gap-3">
          {[
            ['10:24 · event.state_changed', 'Source 插件捕获事件并进入路由阶段。'],
            ['10:31 · industry.analysis.completed', '行业影响分析输出结构化摘要并生成最佳动作候选。'],
            ['10:36 · approval.requested', '高风险建议进入人工确认链路，等待 strong_confirm。'],
            ['10:42 · reanalysis.requested', '因工具超时触发补充验证和重分析请求。'],
          ].map(([title, copy]) => (
            <article key={title} className="grid gap-1.5 border-l-2 border-hairline-strong pl-3.5">
              <p className="m-0 text-[12px] font-bold text-muted">{title}</p>
              <p className="m-0 text-body-sm text-muted">{copy}</p>
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

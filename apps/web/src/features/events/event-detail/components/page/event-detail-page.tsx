import { DegradationNoticeList } from '@/features/event-scoring/components/DegradationNoticeList'
import {
  DetailFacts,
  LinkButton,
  PageHeader,
  PageSectionCard,
  SectionHeader,
} from '@/shared/ui'

import {
  EvidenceAndDiagnosticsPanel,
  InvestmentDecisionPanel,
} from '../analysis/event-analysis-panels'
import { useEventDetailPage } from '../../hooks/use-event-detail-page'

function EventNotFoundState() {
  return (
    <div className="grid gap-5">
      <PageHeader
        kicker="事件详情 / 决策"
        title="事件不存在"
        description="当前事件编号没有匹配到演示数据，请返回事件中心重新选择。"
      />
      <PageSectionCard>
        <SectionHeader
          eyebrow="未找到"
          title="当前事件已移除或编号无效"
          description="首版演示页面不做静默兜底到其他事件，避免误导操盘者查看错误事件上下文。"
        />
        <div className="flex flex-wrap gap-2">
          <LinkButton to="/events" variant="outline">返回事件中心</LinkButton>
        </div>
      </PageSectionCard>
    </div>
  )
}

export function EventDetailPageContent({ eventId }: { eventId: string }) {
  const detail = useEventDetailPage(eventId)

  if (!detail.found || !detail.model) {
    return <EventNotFoundState />
  }

  const {
    bestActionSummary,
    degradationNotices,
    decisionSummary,
    evidenceSummary,
    event,
    factSummary,
    impactSummary,
    relatedApproval,
    relatedRun,
  } = detail.model

  return (
    <div className="grid gap-5">
      <PageHeader
        kicker="事件详情 / 决策"
        title={event.title}
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.32fr)_minmax(340px,0.78fr)]">
        <PageSectionCard className="border-primary/25 bg-primary/5">
          <SectionHeader
            eyebrow="投资处理建议"
          />
          <InvestmentDecisionPanel
            action={bestActionSummary}
            approvalId={relatedApproval?.id ?? null}
            decision={decisionSummary}
            eventId={event.id}
            impact={impactSummary}
            runId={relatedRun?.id ?? null}
          />
        </PageSectionCard>

        <PageSectionCard>
          <SectionHeader
            eyebrow="事件事实"
          />
          <DetailFacts
            rows={[
              `来源：${factSummary.source}`,
              `发布时间：${factSummary.publishedAt}`,
              `当前状态：${factSummary.status}`,
              `可信度：${factSummary.eventReliability} / 100`,
              `验证：${factSummary.verificationStatusLabel}`,
              factSummary.summary,
            ]}
          />
          <DegradationNoticeList notices={degradationNotices} />
          <div className="flex flex-wrap gap-2">
            <LinkButton to="/events" variant="outline">返回重点事件</LinkButton>
            <LinkButton to="/events/all" variant="outline">全部事件</LinkButton>
          </div>
        </PageSectionCard>
      </section>

      <section>
        <PageSectionCard>
          <SectionHeader
            eyebrow="证据与诊断"
          />
          <EvidenceAndDiagnosticsPanel
            eventId={event.id}
            evidence={evidenceSummary}
            runId={relatedRun?.id ?? null}
          />
        </PageSectionCard>
      </section>
    </div>
  )
}

import { DegradationNoticeList } from '@/features/event-scoring/components/DegradationNoticeList'
import {
  LinkButton,
  PageHeader,
  PageSectionCard,
  SectionHeader,
} from '@/shared/ui'
import type { EventDegradationNotice } from '@/features/event-scoring/types/event-scoring.types'

import {
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
    relatedApproval,
  } = detail.model

  return (
    <div className="grid gap-5">
      <PageHeader
        kicker="事件详情 / 决策"
        title={event.title}
      />

      <section>
        <PageSectionCard className="bg-surface">
          <SectionHeader
            eyebrow="投资处理建议"
          />
          <InvestmentDecisionPanel
            action={bestActionSummary}
            approvalId={relatedApproval?.id ?? null}
            decision={decisionSummary}
            eventReliability={factSummary.eventReliability}
            eventId={event.id}
            evidence={evidenceSummary}
            verificationLabel={factSummary.verificationStatusLabel}
          />
          <EventFactStrip
            notices={degradationNotices}
            rows={[
              ['来源', factSummary.source],
              ['时间', factSummary.publishedAt],
              ['状态', factSummary.status],
            ]}
            summary={factSummary.summary}
          />
          <div className="flex flex-wrap gap-2">
            <LinkButton to="/events" variant="outline">返回全部事件</LinkButton>
          </div>
        </PageSectionCard>
      </section>

    </div>
  )
}

function EventFactStrip({
  notices,
  rows,
  summary,
}: {
  notices: readonly EventDegradationNotice[]
  rows: readonly [string, string][]
  summary: string
}) {
  return (
    <div className="grid gap-3 rounded-3xl border border-hairline bg-surface/75 p-3">
      <div className="flex flex-wrap gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-canvas px-3 py-2">
            <span className="mr-2 text-[12px] font-bold text-muted">{label}</span>
            <span className="text-body-sm font-bold text-foreground">{value}</span>
          </div>
        ))}
      </div>
      <p className="m-0 text-body-sm leading-[1.55] text-muted-strong">{summary}</p>
      <DegradationNoticeList notices={notices} />
    </div>
  )
}

import { DegradationNoticeList } from '@/features/event-scoring/components/DegradationNoticeList'
import { LinkButton } from '@/shared/ui'

import { PageSectionCard } from '@/features/mainflow/components/PageSectionCard'
import { SectionHeader } from '@/features/mainflow/components/SectionHeader'
import {
  DetailFacts,
  PageHeader,
} from '@/features/mainflow/pages/shared'

import {
  BestActionCard,
  DecisionBrief,
  EvidenceSummaryPanel,
  IndustryImpactPanel,
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
    runtimeSummary,
  } = detail.model

  return (
    <div className="grid gap-5">
      <PageHeader
        kicker="事件详情 / 决策"
        title={event.title}
        description="事件事实、行业影响分析和最佳动作建议必须分区展示；本页不直接批准或执行高风险动作。"
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.92fr)]">
        <PageSectionCard>
          <SectionHeader
            eyebrow="事件事实"
            title="事实与验证状态"
            description="事实区回答这件事是什么、来自哪里、目前有多可信。"
          />
          <DetailFacts
            rows={[
              `来源：${factSummary.source}`,
              `来源权威度：${factSummary.sourceAuthority}`,
              `发布时间：${factSummary.publishedAt}`,
              `当前状态：${factSummary.status}`,
              `事件可信度：${factSummary.eventReliability} / 100`,
              `验证状态：${factSummary.verificationStatusLabel}`,
              `事件概括：${factSummary.summary}`,
            ]}
          />
          <DegradationNoticeList notices={degradationNotices} />
          <div className="flex flex-wrap gap-2">
            <LinkButton to="/events" variant="outline">返回事件中心</LinkButton>
            <LinkButton to="/events/$eventId/audit" params={{ eventId: event.id }} variant="outline">
              审计时间线
            </LinkButton>
          </div>
        </PageSectionCard>

        <PageSectionCard className="border-primary/25 bg-primary/5">
          <SectionHeader
            eyebrow="决策摘要"
            title="先回答影响、建议、原因和卡点"
            description="右栏是首屏焦点；这里不是新闻正文，也不是直接执行台。"
          />
          <DecisionBrief summary={decisionSummary} />
        </PageSectionCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
        <PageSectionCard>
          <SectionHeader
            eyebrow="行业影响分析"
            title="影响行业、对象、窗口和关键分歧"
            description="分析区把事件影响从事实描述中拆出来，便于操盘者判断下一步复核重点。"
          />
          <IndustryImpactPanel summary={impactSummary} />
        </PageSectionCard>

        <PageSectionCard>
          <SectionHeader
            eyebrow="最佳动作"
            title="只保留一个建议动作"
            description="本页不做多候选比较，也不提供批准或执行入口。"
          />
          <BestActionCard
            action={bestActionSummary}
            approvalId={relatedApproval?.id ?? null}
            eventId={event.id}
            runId={relatedRun?.id ?? null}
          />
        </PageSectionCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        <PageSectionCard>
          <SectionHeader
            eyebrow="支持 / 反方观点"
            title="只展示结构化摘要"
            description="不展示完整推理链，只保留支持观点、反方观点、证据质量和数据缺口。"
          />
          <EvidenceSummaryPanel summary={evidenceSummary} />
        </PageSectionCard>

        <PageSectionCard>
          <SectionHeader
            eyebrow="运行摘要"
            title="把深层排障入口留给运行态"
            description="详情页只给结构化摘要和链路入口，不替代运行态诊断界面。"
          />
          <DetailFacts
            rows={[
              `关联运行记录：${runtimeSummary.runId ?? '暂无'}`,
              `最近分析状态：${runtimeSummary.status}`,
              `模型调用策略：${runtimeSummary.providerPolicy}`,
              `追踪编号：${runtimeSummary.traceId}`,
              `摘要：${runtimeSummary.summary}`,
            ]}
          />
          <div className="flex flex-wrap gap-2">
            {relatedRun ? (
              <LinkButton to="/runtime/agents/$runId" params={{ runId: relatedRun.id }} variant="outline">
                查看运行详情
              </LinkButton>
            ) : null}
            <LinkButton to="/runtime" variant="outline">打开运行态</LinkButton>
          </div>
        </PageSectionCard>
      </section>
    </div>
  )
}

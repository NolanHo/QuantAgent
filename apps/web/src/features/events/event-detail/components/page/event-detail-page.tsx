import { DegradationNoticeList } from '@/features/event-scoring/components/DegradationNoticeList'
import { LinkButton } from '@/shared/ui'

import { PageSectionCard } from '@/features/mainflow/components/PageSectionCard'
import { SectionHeader } from '@/features/mainflow/components/SectionHeader'
import {
  DetailFacts,
  InfoTag,
  PageHeader,
} from '@/features/mainflow/pages/shared'

import { useEventDetailPage } from '../../hooks/use-event-detail-page'

function EventNotFoundState() {
  return (
    <div className="grid gap-5">
      <PageHeader
        kicker="事件详情 / 决策"
        title="事件不存在"
        description="当前事件 ID 没有匹配到 mock 数据，请返回事件中心重新选择。"
      />
      <PageSectionCard>
        <SectionHeader
          eyebrow="未找到"
          title="当前事件已移除或 ID 无效"
          description="首版 mock 页面不做静默兜底到其他事件，避免误导操盘者查看错误事件上下文。"
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
    argumentSummaries,
    bestActionSummary,
    degradationNotices,
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
            title="左栏优先给事实与验证状态"
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

        <PageSectionCard>
          <SectionHeader
            eyebrow="行业影响与最佳动作"
            title="右栏首屏优先展示分析和动作"
            description="首版只展示一个最佳动作，不做多候选动作比较。审批或重分析都从这里继续进入。"
          />
          <DetailFacts
            rows={[
              `影响行业：${impactSummary.industries.join(' / ')}`,
              `影响方向：${impactSummary.impactDirection}`,
              `行业影响强度：${impactSummary.impactStrength} / 100`,
              `分析置信度：${bestActionSummary.analysisConfidence} / 100`,
              `建议推荐度：${bestActionSummary.recommendationScore} / 100`,
              `建议动作：${bestActionSummary.actionHint}，等待审批确认后进入受控链路。`,
              `不确定性摘要：${bestActionSummary.uncertaintySummary}`,
              `审批状态：${bestActionSummary.approvalStatus}`,
              bestActionSummary.riskDirection ? `风险方向：${bestActionSummary.riskDirection}` : '风险方向：待补充',
              bestActionSummary.riskLevel ? `风险等级：${bestActionSummary.riskLevel}` : '风险等级：待补充',
            ]}
          />
          <div className="flex flex-wrap gap-2">
            {relatedApproval ? (
              <LinkButton to="/approvals/$approvalId" params={{ approvalId: relatedApproval.id }}>
                进入审批
              </LinkButton>
            ) : (
              <InfoTag>当前事件暂无关联审批</InfoTag>
            )}
            {relatedRun ? (
              <LinkButton to="/runtime/agents/$runId" params={{ runId: relatedRun.id }} variant="outline">
                查看运行摘要
              </LinkButton>
            ) : (
              <LinkButton to="/runtime" variant="outline">查看运行态</LinkButton>
            )}
          </div>
        </PageSectionCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        <PageSectionCard>
          <SectionHeader
            eyebrow="支持 / 反方观点"
            title="只展示结构化摘要"
            description="不展示完整 chain-of-thought，只保留支持观点、反方观点、证据质量和数据缺口。"
          />
          <ul className="m-0 grid list-none gap-3 p-0">
            {argumentSummaries.map((item) => (
              <li key={item.label} className="grid gap-1.5 border-l-2 border-hairline-strong pl-3.5">
                <p className="m-0 text-[12px] font-bold text-muted">{item.label}</p>
                <p className="m-0 text-body-sm text-muted">{item.text}</p>
              </li>
            ))}
          </ul>
        </PageSectionCard>

        <PageSectionCard>
          <SectionHeader
            eyebrow="运行摘要"
            title="把深层排障入口留给 Runtime"
            description="详情页只给结构化摘要和链路入口，不替代运行态诊断界面。"
          />
          <DetailFacts
            rows={[
              `关联 Agent Run：${runtimeSummary.runId ?? '暂无'}`,
              `最近分析状态：${runtimeSummary.status}`,
              `provider_policy：${runtimeSummary.providerPolicy}`,
              `trace_id：${runtimeSummary.traceId}`,
              `摘要：${runtimeSummary.summary}`,
            ]}
          />
          <div className="flex flex-wrap gap-2">
            {relatedRun ? (
              <LinkButton to="/runtime/agents/$runId" params={{ runId: relatedRun.id }} variant="outline">
                查看 Agent Run 详情
              </LinkButton>
            ) : null}
            <LinkButton to="/runtime" variant="outline">打开 Runtime</LinkButton>
          </div>
        </PageSectionCard>
      </section>
    </div>
  )
}

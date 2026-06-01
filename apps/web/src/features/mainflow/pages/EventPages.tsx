import { healthAlerts } from '../mock-data'
import { PageSectionCard } from '../components/PageSectionCard'
import { SectionHeader } from '../components/SectionHeader'
import { EventScoreCard } from '@/features/event-scoring/components/EventScoreCard'
import {
  scoredApprovals,
  scoredEvents,
} from '@/features/event-scoring/mocks/event-scoring.mock'
import {
  formatVerificationStatus,
} from '@/features/event-scoring/utils/event-scoring-labels'
import { createHealthAlertEventCardModel } from '@/features/event-scoring/utils/event-scoring-adapters'
import { LinkButton } from '@/shared/ui'
import { DetailFacts, InfoTag, PageHeader } from './shared'

export function EventsIndexPageContent() {
  const runtimeAlertCard = healthAlerts.length > 0 && scoredEvents.length > 0
    ? createHealthAlertEventCardModel(healthAlerts[0]!, scoredEvents[0]!)
    : null

  return (
    <div className="grid gap-5">
      <PageHeader
        kicker="事件中心"
        title="高价值事件"
        description="从 Dashboard 进入后的事件浏览和筛选页。这里负责扩展视野，不承担首页总控职责。"
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        <PageSectionCard>
          <SectionHeader
            eyebrow="筛选与排序"
            title="首版只落结构，不发明 API shape"
            description="时间范围、半导体子行业、参考强度、分析状态和来源类型将进入 URL search params；本轮先用静态骨架表达信息架构。"
          />
          <div className="flex flex-wrap gap-2">
            {['时间范围', '半导体子行业', '参考强度', '分析状态', '最新 + 高价值'].map((item) => (
              <InfoTag key={item}>{item}</InfoTag>
            ))}
          </div>
        </PageSectionCard>

        <PageSectionCard>
          <SectionHeader
            eyebrow="系统提醒"
            title="轻量异常摘要"
            description="只做浏览过程中的轻提示，不把运行态排障台塞回事件中心。"
          />
          {runtimeAlertCard ? (
            <div className="grid gap-2">
              <EventScoreCard event={runtimeAlertCard} toDetail={false} />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-hairline-strong bg-surface p-4">
              <p className="m-0 text-body-sm text-muted">
                当前没有可展示的系统提醒。
              </p>
            </div>
          )}
        </PageSectionCard>
      </section>

      <PageSectionCard>
        <SectionHeader
          eyebrow="重点事件"
          title="重点事件区与完整列表并存"
          description="重点区解释为什么值得先看，列表承担稳定跳转到事件详情。"
        />
        <div className="grid gap-3">
          {scoredEvents.map((event) => (
            <EventScoreCard key={event.id} event={event} />
          ))}
        </div>
      </PageSectionCard>
    </div>
  )
}

export function EventDetailPageContent({ eventId }: { eventId: string }) {
  const event = scoredEvents.find((item) => item.id === eventId)

  if (!event) {
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

  const relatedApproval = scoredApprovals.find((item) => item.eventId === event.id) ?? null
  const highlights = event.analysisHighlights

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
            title="左栏先给事实和验证状态"
            description="事实区保留来源、发布时间、事件状态和可信度摘要。"
          />
          <DetailFacts
            rows={[
              `来源：${event.source}`,
              `来源权威度：${event.score.sourceAuthority}`,
              `发布时间：${event.publishedAt}`,
              `当前状态：${event.status}`,
              `事件可信度：${event.score.eventReliability} / 100`,
              `验证状态：${formatVerificationStatus(event.score.verificationStatus)}`,
              `事件概括：${event.summary}`,
            ]}
          />
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
            description="首版只展示一个最佳动作，不做多候选动作比较工作台。"
          />
          <DetailFacts
            rows={[
              `影响行业：${event.industries.join(' / ')}`,
              `影响方向：${event.impactDirection}`,
              `行业影响强度：${event.score.impactStrength} / 100`,
              `分析置信度：${event.score.analysisConfidence} / 100`,
              `建议推荐度：${event.score.recommendationScore} / 100`,
              `建议动作：${event.actionHint}，等待审批确认后进入受控链路。`,
              `不确定性摘要：${event.score.uncertaintySummary}`,
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
            <LinkButton to="/runtime" variant="outline">查看运行摘要</LinkButton>
          </div>
        </PageSectionCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        <PageSectionCard>
          <SectionHeader
            eyebrow="支持 / 反方观点"
            title="只展示结构化摘要"
            description="不展示完整 chain-of-thought，也不回放原始长推理文本。"
          />
          <ul className="m-0 grid list-none gap-3 p-0">
            {[
              ['支持观点', highlights?.support ?? '当前事件暂无额外支持观点摘要。'],
              ['反方观点', highlights?.opposition ?? '当前事件暂无额外反方观点摘要。'],
              ['验证状态', highlights?.verificationNote ?? `当前为 ${formatVerificationStatus(event.score.verificationStatus)}，需要继续补齐交叉信源。`],
              ['数据缺口', event.score.uncertaintySummary],
              ['降级摘要', event.degradationNotices.map((item) => item.title).join(' / ') || '当前无降级提示'],
            ].map(([label, text]) => (
              <li key={label} className="grid gap-1.5 border-l-2 border-hairline-strong pl-3.5">
                <p className="m-0 text-[12px] font-bold text-muted">{label}</p>
                <p className="m-0 text-body-sm text-muted">{text}</p>
              </li>
            ))}
          </ul>
        </PageSectionCard>

        <PageSectionCard>
          <SectionHeader
            eyebrow="运行摘要"
            title="把 trace / request 入口留给 Runtime"
            description="详情页只给结构化摘要和入口，不替代运行态诊断界面。"
          />
          <DetailFacts
            rows={[
              '关联 Agent Run：2',
              '最近分析状态：decision_ready',
              '关键工具失败：0',
              'trace_id 占位：rt-mainflow-evt-001',
            ]}
          />
        </PageSectionCard>
      </section>
    </div>
  )
}

export function EventAuditPageContent({ eventId }: { eventId: string }) {
  return (
    <div className="grid gap-5">
      <PageHeader
        kicker="事件级审计"
        title="事件时间线"
        description="按事件回放建议、重分析和人工动作。这里只做时间线骨架，不发明新的审计 contract。"
      />

      <PageSectionCard>
        <SectionHeader
          eyebrow="Audit"
          title={`事件 ${eventId} 的关键节点`}
          description="真实审计记录以后端真源为准；本轮先把入口和阅读顺序落地。"
        />
        <div className="grid gap-3">
          {[
            ['10:24 · 事件采集', 'Source 插件捕获事件并进入路由阶段。'],
            ['10:31 · 影响分析完成', '行业影响分析输出结构化摘要并生成最佳动作候选。'],
            ['10:36 · 审批请求生成', '高风险建议已进入人工确认链路，等待 strong_confirm。'],
          ].map(([title, copy]) => (
            <article key={title} className="grid gap-1.5 border-l-2 border-hairline-strong pl-3.5">
              <p className="m-0 text-[12px] font-bold text-muted">{title}</p>
              <p className="m-0 text-body-sm text-muted">{copy}</p>
            </article>
          ))}
        </div>
      </PageSectionCard>
    </div>
  )
}

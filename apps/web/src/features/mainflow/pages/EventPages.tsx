import {
  healthAlerts,
} from '../mock-data'
import { PageSectionCard } from '../components/PageSectionCard'
import { SectionHeader } from '../components/SectionHeader'
import { EventScoreCard } from '@/features/event-scoring/components/EventScoreCard'
import {
  scoredEvents,
} from '@/features/event-scoring/mocks/event-scoring.mock'
import { createHealthAlertEventCardModel } from '@/features/event-scoring/utils/event-scoring-adapters'
import { InfoTag, PageHeader } from './shared'

export function EventsIndexPageContent() {
  const runtimeAlertCards = scoredEvents.length > 0
    ? healthAlerts.map((alert, index) => createHealthAlertEventCardModel(alert, scoredEvents[index] ?? scoredEvents[0]!))
    : []

  return (
    <div className="grid gap-5">
      <PageHeader
        kicker="事件中心"
        title="高价值事件中心"
        description="从 Dashboard 进入后的事件浏览和筛选页。这里承接重点事件扩展与全量浏览，不承担审批或运行态排障。"
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        <PageSectionCard>
          <SectionHeader
            eyebrow="筛选与排序"
            title="筛选条件进入 URL search params"
            description="时间范围、行业、事件可信度、分析状态、来源类型和排序方式都需要可恢复；本轮先用结构化占位表达入口。"
          />
          <div className="flex flex-wrap gap-2">
            {['时间范围', '行业', '事件可信度', '分析状态', '来源类型', '最新 + 高价值混合'].map((item) => (
              <InfoTag key={item}>{item}</InfoTag>
            ))}
          </div>
        </PageSectionCard>

        <PageSectionCard>
          <SectionHeader
            eyebrow="轻量系统提醒"
            title="只提醒，不替代 Runtime"
            description="只放影响当前浏览判断质量的异常，详细排障仍回到 Runtime。"
          />
          {runtimeAlertCards.length > 0 ? (
            <div className="grid gap-2">
              {runtimeAlertCards.map((event) => (
                <EventScoreCard key={event.id} event={event} toDetail={false} />
              ))}
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
          eyebrow="重点事件与列表"
          title="重点事件区与完整列表并存"
          description="重点区解释为什么值得先看，事件卡片负责稳定进入详情页和审计页。"
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

import { EventScoreCard } from '@/features/event-scoring/components/EventScoreCard'

import {
  PageHeader,
  PageSectionCard,
  SectionHeader,
} from '@/shared/ui'

import { EventListRow } from '../event-list/event-list-row'
import { MockFilterBar } from '../filters/mock-filter-bar'
import { EventCenterMetricGrid } from '../overview/event-center-metric-grid'
import { useEventCenterPage } from '../../hooks/use-event-center-page'

export function EventsIndexPageContent() {
  const model = useEventCenterPage()

  return (
    <div className="grid gap-5">
      <PageHeader
        kicker="事件中心"
        title="高价值事件中心"
        description="用于浏览高价值事件、筛选分析线索，并进入事件详情或审计记录。"
      />

      <EventCenterMetricGrid metrics={model.metrics} />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.8fr)]">
        <PageSectionCard>
          <SectionHeader
            eyebrow="今日重点事件"
            title="先看为什么值得进入分析页"
            description="重点区展示优先级、可信度、行业影响和入选原因。"
          />
          <div className="grid gap-3 lg:grid-cols-2">
            {model.featuredEvents.map((event) => (
              <EventScoreCard key={event.id} event={event} />
            ))}
          </div>
        </PageSectionCard>

        <PageSectionCard>
          <SectionHeader
            eyebrow="筛选与排序"
            title="按事件价值收窄范围"
            description="先按状态、风险、行业和价值排序筛出值得继续分析的事件。"
          />
          <MockFilterBar title="筛选条件" options={model.filters} />
          <MockFilterBar title="排序方式" options={model.sortOptions} />
          <div className="rounded-2xl border border-dashed border-hairline-strong bg-surface p-3">
            <p className="m-0 text-body-sm text-muted">
              当前筛选项用于呈现目标维度，正式数据接入后会同步为可分享的筛选条件。
            </p>
          </div>
        </PageSectionCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.75fr)]">
        <PageSectionCard>
          <SectionHeader
            eyebrow="全量事件列表"
            title="每行都能完成初筛并进入详情"
            description="列表行展示事件事实、评分摘要、行业标签和分析状态。"
          />
          <div className="grid gap-3">
            {model.listItems.map((item) => (
              <EventListRow key={item.event.id} item={item} />
            ))}
          </div>
        </PageSectionCard>

        <PageSectionCard>
          <SectionHeader
            eyebrow="轻量系统提醒"
            title="只提醒，不替代运行记录"
            description="这些提醒帮助判断事件分析质量，但不参与事件高价值排序。"
          />
          {model.runtimeAlertEvents.length > 0 ? (
            <div className="grid gap-2">
              {model.runtimeAlertEvents.map((event) => (
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
    </div>
  )
}

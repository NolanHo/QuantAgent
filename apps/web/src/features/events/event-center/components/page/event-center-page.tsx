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
      />

      <EventCenterMetricGrid metrics={model.metrics} />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.8fr)]">
        <PageSectionCard>
          <SectionHeader
            eyebrow="今日重点事件"
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
          />
          <MockFilterBar title="筛选条件" options={model.filters} />
          <MockFilterBar title="排序方式" options={model.sortOptions} />
        </PageSectionCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.75fr)]">
        <PageSectionCard>
          <SectionHeader
            eyebrow="全量事件列表"
            title="每行都能完成初筛并进入详情"
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
            title="系统提醒"
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

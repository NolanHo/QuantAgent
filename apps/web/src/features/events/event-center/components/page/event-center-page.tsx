import { EventScoreCard } from '@/features/event-scoring/components/EventScoreCard'

import {
  PageHeader,
  PageSectionCard,
  SectionHeader,
} from '@/shared/ui'

import { EventListRow } from '../event-list/event-list-row'
import { EventCenterFilterNav } from '../filters/event-center-filter-nav'
import { useEventCenterPage } from '../../hooks/use-event-center-page'

export function EventsIndexPageContent() {
  const page = useEventCenterPage()
  const { model } = page

  return (
    <div className="grid gap-5">
      <PageHeader
        kicker="事件中心"
        title="高价值事件中心"
      />

      <EventCenterFilterNav
        groups={model.filterGroups}
        onFilterChange={page.selectFilter}
        onSortChange={page.selectSort}
        sortOptions={model.sortOptions}
      />

      <section>
        <PageSectionCard>
          <SectionHeader
            eyebrow="今日重点事件"
          />
          {model.featuredEvents.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {model.featuredEvents.map((event) => (
                <EventScoreCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <EventCenterEmptyState />
          )}
        </PageSectionCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.75fr)]">
        <PageSectionCard>
          <SectionHeader
            eyebrow="全量事件列表"
          />
          {model.listItems.length > 0 ? (
            <div className="grid gap-3">
              {model.listItems.map((item) => (
                <EventListRow key={item.event.id} item={item} />
              ))}
            </div>
          ) : (
            <EventCenterEmptyState />
          )}
        </PageSectionCard>

        <PageSectionCard>
          <SectionHeader
            eyebrow="轻量系统提醒"
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

function EventCenterEmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-hairline-strong bg-surface p-4">
      <p className="m-0 text-body-sm text-muted">当前筛选下暂无事件。</p>
    </div>
  )
}

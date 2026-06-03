import { EventScoreCard } from '@/features/event-scoring/components/EventScoreCard'

import {
  LinkButton,
  PageHeader,
  PageSectionCard,
  SectionHeader,
} from '@/shared/ui'

import { EventListRow } from '../event-list/event-list-row'
import { EventCenterAlertStrip } from '../alerts/event-center-alert-strip'
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

      <EventCenterAlertStrip alerts={model.runtimeAlerts} />

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
          <div className="mt-4 flex justify-end">
            <LinkButton to="/events/all" variant="outline">
              查看全部事件
            </LinkButton>
          </div>
        </PageSectionCard>
      </section>
    </div>
  )
}

export function EventsAllPageContent() {
  const page = useEventCenterPage()
  const { model } = page

  return (
    <div className="grid gap-5">
      <PageHeader
        kicker="事件池"
        title="全部事件"
      />

      <div className="flex justify-end">
        <LinkButton to="/events" variant="outline">
          返回重点事件
        </LinkButton>
      </div>

      <EventCenterFilterNav
        groups={model.filterGroups}
        onFilterChange={page.selectFilter}
        onSortChange={page.selectSort}
        sortOptions={model.sortOptions}
      />

      <section>
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

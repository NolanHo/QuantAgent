import {
  PageHeader,
  PageSectionCard,
  SectionHeader,
} from '@/shared/ui'

import { EventListRow } from '../event-list/event-list-row'
import { EventCenterFilterNav } from '../filters/event-center-filter-nav'
import { useEventCenterPage } from '../../hooks/use-event-center-page'
import type { EventCenterListItem } from '../../types/event-center.types'

export function EventsIndexPageContent() {
  const page = useEventCenterPage()
  const { model } = page

  return (
    <div className="grid gap-5">
      <PageHeader
        kicker="事件池"
        title="全部事件"
      />

      <EventCenterFilterNav
        groups={model.filterGroups}
        onFilterChange={page.selectFilter}
        onSortChange={page.selectSort}
        sortOptions={model.sortOptions}
      />

      <EventCenterListSection items={model.listItems} />
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

      <EventCenterFilterNav
        groups={model.filterGroups}
        onFilterChange={page.selectFilter}
        onSortChange={page.selectSort}
        sortOptions={model.sortOptions}
      />

      <EventCenterListSection items={model.listItems} />
    </div>
  )
}

function EventCenterListSection({ items }: { items: readonly EventCenterListItem[] }) {
  return (
    <section>
      <PageSectionCard>
        <SectionHeader
          eyebrow="事件列表"
        />
        {items.length > 0 ? (
          <div className="grid gap-3">
            {items.map((item) => (
              <EventListRow key={item.event.id} item={item} />
            ))}
          </div>
        ) : (
          <EventCenterEmptyState />
        )}
      </PageSectionCard>
    </section>
  )
}

function EventCenterEmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-hairline-strong bg-surface p-4">
      <p className="m-0 text-body-sm text-muted">当前筛选下暂无事件。</p>
    </div>
  )
}

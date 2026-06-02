import { Link } from '@tanstack/react-router'

import {
  InfoTag,
  LinkButton,
} from '@/shared/ui'
import { formatRelativeMinutes } from '@/shared/utils'

import type { EventCenterListItem } from '../../types/event-center.types'

export function EventListRow({ item }: { item: EventCenterListItem }) {
  const { event } = item

  return (
    <article className="grid gap-3 rounded-3xl border border-hairline bg-surface p-4">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <Link
          className="grid gap-3 rounded-2xl outline-none transition hover:bg-canvas/70 focus-visible:ring-2 focus-visible:ring-primary/40"
          params={{ eventId: event.id }}
          to="/events/$eventId"
        >
          <div className="grid gap-3 xl:grid-cols-[56px_minmax(0,1fr)]">
            <div className="rounded-2xl bg-canvas px-3 py-2 text-center text-body-sm font-extrabold text-muted">
              {item.rankLabel}
            </div>
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <InfoTag>{item.analysisState}</InfoTag>
                <InfoTag>{event.impactDirection}</InfoTag>
                <InfoTag>{formatRelativeMinutes(event.publishedMinutesAgo)}</InfoTag>
              </div>
              <h3 className="m-0 text-title-sm font-extrabold leading-tight text-foreground">{event.title}</h3>
              <p className="m-0 text-body-sm leading-[1.55] text-muted">{event.summary}</p>
            </div>
          </div>
          <div className="grid gap-2 border-t border-hairline pt-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.4fr)]">
            <div className="grid gap-1">
              <p className="m-0 text-[12px] font-bold text-muted">评分摘要</p>
              <p className="m-0 text-body-sm text-muted-strong">{item.scoreSummary}</p>
            </div>
            <div className="grid gap-1">
              <p className="m-0 text-[12px] font-bold text-muted">入选原因</p>
              <p className="m-0 text-body-sm text-muted-strong">{item.rowReason}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {event.industries.map((industry) => (
              <InfoTag key={industry}>{industry}</InfoTag>
            ))}
          </div>
        </Link>
        <div className="flex flex-wrap gap-2 xl:justify-end">
          <LinkButton to="/events/$eventId" params={{ eventId: event.id }}>
            查看分析
          </LinkButton>
          <LinkButton to="/events/$eventId/audit" params={{ eventId: event.id }} variant="outline">
            审计
          </LinkButton>
        </div>
      </div>
    </article>
  )
}

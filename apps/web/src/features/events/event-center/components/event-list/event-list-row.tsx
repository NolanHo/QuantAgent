import { Chip } from '@heroui/react'
import { Link } from '@tanstack/react-router'

import {
  InfoTag,
  LinkButton,
} from '@/shared/ui'
import { formatRelativeMinutes } from '@/shared/utils'

import type { EventCenterListItem } from '../../types/event-center.types'

const bandToneClass = {
  A: 'from-sky-500 to-cyan-400',
  B: 'from-amber-500 to-orange-400',
  C: 'from-slate-400 to-slate-300',
  S: 'from-rose-500 to-amber-400',
} as const

export function EventListRow({ item }: { item: EventCenterListItem }) {
  const { event } = item
  const bandTone = bandToneClass[event.score.priorityBand]

  return (
    <article className="group overflow-hidden rounded-3xl border border-hairline bg-surface shadow-[0_10px_28px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
      <div className="grid md:grid-cols-[8px_minmax(0,1fr)]">
        <div className={`min-h-2 bg-gradient-to-b ${bandTone}`} />
        <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_250px] xl:items-start">
          <Link
            className="grid gap-3 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            params={{ eventId: event.id }}
            to="/events/$eventId"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-canvas px-3 py-1 text-[12px] font-extrabold text-muted">
                {item.rankLabel}
              </span>
              <InfoTag>{item.analysisState}</InfoTag>
              <InfoTag>{formatRelativeMinutes(event.publishedMinutesAgo)}</InfoTag>
              <span className="rounded-full bg-danger/10 px-3 py-1 text-body-sm font-bold text-danger">
                {event.impactDirection}
              </span>
            </div>

            <div className="grid gap-2">
              <h3 className="m-0 text-title-sm font-extrabold leading-tight text-foreground group-hover:text-primary">
                {event.title}
              </h3>
              <p className="m-0 line-clamp-2 text-body-sm leading-[1.55] text-muted">{event.summary}</p>
              <div className="flex flex-wrap gap-2">
                {event.industries.map((industry) => (
                  <Chip key={industry} className="bg-surface-soft text-body-sm font-bold text-muted-strong" size="sm" variant="soft">
                    {industry}
                  </Chip>
                ))}
              </div>
            </div>
          </Link>

          <div className="grid gap-3 rounded-2xl bg-canvas p-3">
            <div className="grid grid-cols-2 gap-2">
              <ScorePill value={item.priorityLabel} />
              <ScorePill value={item.reliabilityLabel} />
              <ScorePill value={item.impactLabel} />
              <ScorePill value={item.verificationLabel} />
            </div>
            <p className="m-0 rounded-2xl bg-surface px-3 py-2 text-body-sm font-bold leading-[1.5] text-muted-strong">
              {item.rowReason}
            </p>
            <div className="flex flex-wrap gap-2 xl:justify-end">
              <LinkButton to="/events/$eventId" params={{ eventId: event.id }}>
                查看分析
              </LinkButton>
              <LinkButton to="/events/$eventId/audit" params={{ eventId: event.id }} variant="outline">
                审计
              </LinkButton>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

function ScorePill({ value }: { value: string }) {
  return (
    <div className="rounded-2xl bg-surface px-3 py-2 text-[12px] font-extrabold leading-tight text-foreground">
      {value}
    </div>
  )
}

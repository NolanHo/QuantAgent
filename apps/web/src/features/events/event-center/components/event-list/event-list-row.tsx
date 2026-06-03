import { Chip } from '@heroui/react'
import { Link } from '@tanstack/react-router'

import {
  getImpactTone,
  getPriorityTone,
  getReliabilityTone,
  scoreNeutralTone,
} from '@/features/event-scoring/utils/event-score-tones'
import {
  InfoTag,
  LinkButton,
} from '@/shared/ui'
import { formatRelativeMinutes } from '@/shared/utils'

import type { EventCenterListItem } from '../../types/event-center.types'

export function EventListRow({ item }: { item: EventCenterListItem }) {
  const { event } = item
  const priorityTone = getPriorityTone(event.score.priorityBand, event.score.eventPriority)
  const reliabilityTone = getReliabilityTone(event.score.eventReliability)
  const impactTone = getImpactTone(event.score.impactStrength)

  return (
    <article className="group overflow-hidden rounded-3xl border border-hairline bg-surface shadow-[0_10px_28px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_238px] xl:items-start">
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
            <span className={`rounded-full px-3 py-1 text-body-sm font-bold ${impactTone.tagClass}`}>
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
          <div className="grid grid-cols-3 gap-2">
            <ScorePill label="优先级" toneClass={priorityTone.scoreClass} value={event.score.eventPriority} />
            <ScorePill label="可信度" toneClass={reliabilityTone.scoreClass} value={event.score.eventReliability} />
            <ScorePill label="影响" toneClass={impactTone.scoreClass} value={event.score.impactStrength} />
          </div>
          <div className="rounded-2xl bg-surface px-3 py-2 text-[12px] font-extrabold text-muted-strong">
            {item.verificationLabel}
          </div>
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
    </article>
  )
}

function ScorePill({
  label,
  toneClass = scoreNeutralTone.scoreClass,
  value,
}: {
  label: string
  toneClass?: string
  value: number
}) {
  return (
    <div className={`rounded-2xl px-3 py-2 text-center ${toneClass}`}>
      <p className="m-0 text-[11px] font-extrabold opacity-75">{label}</p>
      <p className="m-0 mt-0.5 text-[22px] font-extrabold leading-none">{value}</p>
    </div>
  )
}

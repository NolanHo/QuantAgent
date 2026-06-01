import {
  Card,
  Chip,
} from '@heroui/react'

import { LinkButton } from '@/shared/ui'
import { formatRelativeMinutes } from '@/shared/utils'

import type { EventScoreCardModel } from '../types/event-scoring.types'
import {
  formatEventReliability,
  formatFreshnessLabel,
  formatImpactStrength,
  formatPriorityLabel,
} from '../utils/event-scoring-labels'

export function DashboardEventSummaryCard({ event }: { event: EventScoreCardModel }) {
  return (
    <Card className="h-full border border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))]">
      <div className="grid gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip className="bg-[rgb(59_130_246_/_0.12)] text-[10px] font-bold text-[rgb(29_78_216)]" size="sm" variant="soft">
            {formatPriorityLabel(event.score.eventPriority, event.score.priorityBand)}
          </Chip>
          <Chip className="bg-[rgb(15_23_42_/_0.06)] text-[10px] font-bold text-muted-strong" size="sm" variant="soft">
            {formatEventReliability(event.score.eventReliability)}
          </Chip>
          <Chip className="bg-[rgb(15_23_42_/_0.06)] text-[10px] font-bold text-muted-strong" size="sm" variant="soft">
            {formatImpactStrength(event.score.impactStrength)}
          </Chip>
          <Chip className="bg-[rgb(15_23_42_/_0.06)] text-[10px] font-bold text-muted-strong" size="sm" variant="soft">
            {formatFreshnessLabel(event.score.freshness)}
          </Chip>
        </div>

        <div className="grid gap-1.5">
          <h3 className="m-0 overflow-wrap-anywhere text-title-sm font-bold text-ink">
            {event.title}
          </h3>
          <p className="m-0 text-[11px] font-bold text-muted">
            {formatRelativeMinutes(event.publishedMinutesAgo)} · {event.source}
          </p>
        </div>

        <p className="m-0 text-body-sm leading-[1.55] text-body">
          {event.summary}
        </p>

        <div className="grid gap-2">
          <p className="m-0 text-[11px] leading-[1.5] text-muted-strong">
            入选原因：{event.score.selectionReason}
          </p>
          <p className="m-0 text-[11px] leading-[1.5] text-muted-strong">
            {event.actionHint}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <LinkButton to="/events/$eventId" params={{ eventId: event.id }}>
            查看分析
          </LinkButton>
          <LinkButton to="/events" variant="outline">
            查看全部
          </LinkButton>
        </div>
      </div>
    </Card>
  )
}

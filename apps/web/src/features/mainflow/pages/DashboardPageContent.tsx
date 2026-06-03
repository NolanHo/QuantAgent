import { Chip } from '@heroui/react'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import {
  healthAlerts,
} from '../mock-data'
import {
  scoredApprovals,
  scoredEvents,
} from '@/features/event-scoring/mocks/event-scoring.mock'
import type {
  ApprovalScoreCardModel,
  EventScoreCardModel,
} from '@/features/event-scoring/types/event-scoring.types'
import {
  formatVerificationStatus,
} from '@/features/event-scoring/utils/event-scoring-labels'
import {
  getImpactTone,
  getPriorityTone,
  getReliabilityTone,
  scoreNeutralTone,
} from '@/features/event-scoring/utils/event-score-tones'
import { selectDashboardHighlightedEvents } from '@/features/event-scoring/utils/event-scoring-selectors'
import {
  InfoTag,
  LinkButton,
  PageHeader,
  PageSectionCard,
  SectionHeader,
} from '@/shared/ui'
import { formatRelativeMinutes } from '@/shared/utils'

export function DashboardPageContent() {
  const dashboardHighlightedEvents = selectDashboardHighlightedEvents(scoredEvents)
  const firstApproval = scoredApprovals[0] ?? null
  const firstHealthAlert = healthAlerts[0] ?? null

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Dashboard"
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <PageSectionCard className="border-primary/20 bg-surface">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <SectionHeader
              eyebrow="今日重点事件"
            />
            <LinkButton to="/events" variant="outline">全部事件</LinkButton>
          </div>

          {dashboardHighlightedEvents.length > 0 ? (
            <div className="grid gap-3">
              {dashboardHighlightedEvents.map((event, index) => (
                <DashboardEventRow key={event.id} event={event} rank={index + 1} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-hairline-strong bg-surface p-4">
              <p className="m-0 text-body-sm text-muted">
                当前没有需要抬到首页的事件，进入全部事件查看完整事件池。
              </p>
            </div>
          )}
        </PageSectionCard>

        <aside className="grid content-start gap-3">
          <DashboardSignalCard
            eyebrow="待处理审批"
            title={firstApproval ? firstApproval.actionLabel : '当前没有待处理审批'}
            copy={firstApproval ? buildApprovalSummary(firstApproval) : '无需在首页处理人工确认。'}
            action={<LinkButton to="/approvals" variant="outline">审批工作台</LinkButton>}
          />
          <DashboardSignalCard
            eyebrow="关键健康提醒"
            title={firstHealthAlert ? firstHealthAlert.title : '运行状态正常'}
            copy={firstHealthAlert ? firstHealthAlert.summary : '当前没有影响事件判断质量的提醒。'}
            action={<LinkButton to="/runtime" variant="outline">运行态</LinkButton>}
          />
          <PageSectionCard>
            <SectionHeader
              eyebrow="工作入口"
              title="进入完整工作台"
            />
            <div className="grid gap-2">
              <LinkButton to="/events" className="justify-start" variant="outline">全部事件</LinkButton>
              <LinkButton to="/approvals" className="justify-start" variant="outline">审批工作台</LinkButton>
              <LinkButton to="/runtime" className="justify-start" variant="outline">运行态</LinkButton>
            </div>
          </PageSectionCard>
        </aside>
      </div>
    </div>
  )
}

function DashboardEventRow({
  event,
  rank,
}: {
  event: EventScoreCardModel
  rank: number
}) {
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
              #{String(rank).padStart(2, '0')}
            </span>
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
            <ScorePill label="优先级" toneClass={priorityTone?.scoreClass} value={event.score.eventPriority} />
            <ScorePill label="可信度" toneClass={reliabilityTone.scoreClass} value={event.score.eventReliability} />
            <ScorePill label="影响" toneClass={impactTone.scoreClass} value={event.score.impactStrength} />
          </div>
          <div className="rounded-2xl bg-surface px-3 py-2 text-[12px] font-extrabold text-muted-strong">
            {formatVerificationStatus(event.score.verificationStatus)}
          </div>
          <div className="flex flex-wrap gap-2 xl:justify-end">
            <LinkButton to="/events/$eventId" params={{ eventId: event.id }}>查看分析</LinkButton>
            <LinkButton to="/events" variant="outline">全部事件</LinkButton>
          </div>
        </div>
      </div>
    </article>
  )
}

function DashboardSignalCard({
  action,
  copy,
  eyebrow,
  title,
}: {
  action: ReactNode
  copy: string
  eyebrow: string
  title: string
}) {
  return (
    <PageSectionCard>
      <div className="grid gap-3">
        <SectionHeader
          eyebrow={eyebrow}
          title={title}
        />
        <p className="m-0 text-body-sm leading-[1.55] text-muted-strong">{copy}</p>
        <div className="flex flex-wrap gap-2">{action}</div>
      </div>
    </PageSectionCard>
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

function buildApprovalSummary(approval: ApprovalScoreCardModel) {
  return `推荐度 ${approval.scoreContext.recommendationScore} / 100，${approval.scoreContext.expiresIn} 后进入到期策略。`
}

import {
  getRecommendationTone,
  getReliabilityTone,
  scoreNeutralTone,
} from '@/features/event-scoring/utils/event-score-tones'
import {
  LinkButton,
} from '@/shared/ui'

import type {
  BestActionSummary,
  DecisionHeroSummary,
  EvidenceQualitySummary,
} from '../../types/event-detail.types'

function MetricPill({
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
      <p className="m-0 mt-0.5 text-[24px] font-extrabold leading-none">{value}</p>
    </div>
  )
}

function FocusTag({
  className,
  label,
}: {
  className: string
  label: string
}) {
  return (
    <span className={`rounded-full border px-3 py-1 text-[12px] font-extrabold ${className}`}>
      {label}
    </span>
  )
}

function getFocusTone({
  analysisConfidence,
  eventReliability,
  recommendationScore,
}: {
  analysisConfidence: number
  eventReliability: number
  recommendationScore: number
}) {
  if (recommendationScore <= 0 || analysisConfidence < 30) {
    return {
      label: '暂不形成动作',
      className: scoreNeutralTone.tagClass,
    }
  }

  if (eventReliability >= 80 && recommendationScore >= 70) {
    return {
      label: '高可信建议',
      className: getRecommendationTone(recommendationScore).tagClass,
    }
  }

  return {
    label: '待复核建议',
    className: scoreNeutralTone.tagClass,
  }
}

export function DecisionBrief({
  action,
  eventReliability,
  summary,
  verificationLabel,
}: {
  action: BestActionSummary
  eventReliability: number
  summary: DecisionHeroSummary
  verificationLabel: string
}) {
  const focusTone = getFocusTone({
    analysisConfidence: action.analysisConfidence,
    eventReliability,
    recommendationScore: action.recommendationScore,
  })
  const recommendationTone = getRecommendationTone(action.recommendationScore)
  const reliabilityTone = getReliabilityTone(eventReliability)
  const confidenceTone = getReliabilityTone(action.analysisConfidence)

  return (
    <div className={`grid gap-3 rounded-3xl p-4 ${recommendationTone.panelClass}`}>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <FocusTag className={recommendationTone.tagClass} label={recommendationTone.label} />
            <FocusTag className={focusTone.className} label={focusTone.label} />
            <span className="text-body-sm font-bold text-muted-strong">
              {verificationLabel}
            </span>
          </div>
          <h2 className="m-0 text-[30px] font-extrabold leading-tight text-foreground md:text-[34px]">
            {summary.recommendedAction}
          </h2>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
          <MetricPill label="推荐度" value={action.recommendationScore} toneClass={recommendationTone.scoreClass} />
          <MetricPill label="可信度" value={eventReliability} toneClass={reliabilityTone.scoreClass} />
          <MetricPill label="置信度" value={action.analysisConfidence} toneClass={confidenceTone.scoreClass} />
        </div>
      </div>
      <div className="grid gap-2 rounded-2xl bg-surface px-3 py-3">
        <p className="m-0 text-body-sm font-bold text-foreground">{summary.impactQuestion}</p>
        <p className="m-0 text-body-sm text-muted-strong">{summary.rationale}</p>
      </div>
    </div>
  )
}

export function BestActionCard({
  approvalId,
  eventId,
}: {
  approvalId: string | null
  eventId: string
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {approvalId ? (
        <LinkButton to="/approvals/$approvalId" params={{ approvalId }} variant="outline">
          审批记录
        </LinkButton>
      ) : null}
      <LinkButton to="/events/$eventId/audit" params={{ eventId }} variant="outline">
        审计时间线
      </LinkButton>
    </div>
  )
}

export function InvestmentDecisionPanel({
  action,
  approvalId,
  decision,
  eventReliability,
  eventId,
  evidence,
  verificationLabel,
}: {
  action: BestActionSummary
  approvalId: string | null
  decision: DecisionHeroSummary
  eventReliability: number
  eventId: string
  evidence: EvidenceQualitySummary
  verificationLabel: string
}) {
  return (
    <div className="grid gap-4">
      <DecisionBrief
        action={action}
        eventReliability={eventReliability}
        summary={decision}
        verificationLabel={verificationLabel}
      />
      <div className="grid gap-2">
        <div className="grid gap-2 md:grid-cols-2">
          <ReasonBlock label="支持理由" text={evidence.support} tone="support" />
          <ReasonBlock label="反方观点" text={evidence.opposition} tone="opposition" />
        </div>
        <EvidenceMeta summary={evidence} />
      </div>
      <BestActionCard approvalId={approvalId} eventId={eventId} />
    </div>
  )
}

function EvidenceMeta({ summary }: { summary: EvidenceQualitySummary }) {
  const items = [
    ['证据', summary.evidenceQuality],
    ['验证', summary.verificationNote],
    ['缺口', summary.dataGap],
  ] as const

  return (
    <dl className="m-0 grid gap-2 sm:grid-cols-3">
      {items.map(([label, text]) => (
        <div key={label} className="min-w-0 rounded-2xl border border-hairline bg-surface/70 px-3 py-2">
          <dt className="text-[11px] font-extrabold text-muted">{label}</dt>
          <dd className="m-0 mt-1 line-clamp-2 text-body-sm leading-[1.45] text-muted-strong">{text}</dd>
        </div>
      ))}
    </dl>
  )
}

function ReasonBlock({
  label,
  text,
  tone,
}: {
  label: string
  text: string
  tone: 'support' | 'opposition'
}) {
  const toneClass = tone === 'support'
    ? 'border-hairline bg-surface/80'
    : 'border-hairline bg-canvas'

  return (
    <div className={`rounded-2xl border px-3 py-2 ${toneClass}`}>
      <p className="m-0 text-[12px] font-extrabold text-muted">{label}</p>
      <p className="m-0 mt-1 text-body-sm text-muted-strong">{text}</p>
    </div>
  )
}

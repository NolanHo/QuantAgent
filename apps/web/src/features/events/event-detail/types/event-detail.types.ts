import type {
  ApprovalScoreCardModel,
  EventDegradationNotice,
  EventScoreCardModel,
} from '@/features/event-scoring/types/event-scoring.types'

export interface EventRunSummary {
  id: string
  status: string
  providerPolicy?: string
  duration: string
  traceId: string
  summary: string
}

export interface EventFactSummary {
  source: string
  sourceAuthority: string
  publishedAt: string
  status: string
  eventReliability: number
  verificationStatusLabel: string
  summary: string
}

export interface IndustryImpactSummary {
  industries: string[]
  affectedObjects: readonly string[]
  impactDirection: string
  impactStrength: number
  impactWindow: string
  riskPoints: readonly string[]
  consensusSummary: string
  divergenceSummary: string
}

export interface BestActionSummary {
  actionTitle: string
  actionHint: string
  analysisConfidence: number
  recommendationScore: number
  approvalId: string | null
}

export interface DecisionHeroSummary {
  impactQuestion: string
  recommendedAction: string
  rationale: string
}

export interface EvidenceQualitySummary {
  support: string
  opposition: string
  evidenceQuality: string
  dataGap: string
  verificationNote: string
}

export interface ArgumentSummaryItem {
  label: string
  text: string
}

export interface RuntimeSummary {
  runId: string | null
  status: string
  providerPolicy: string
  traceId: string
  summary: string
}

export interface AuditSummary {
  eventReliability: number
  impactStrength: number
  status: string
  approvalId: string | null
  runId: string | null
}

export interface AuditTimelineItem {
  title: string
  copy: string
}

export interface EventDetailPageModel {
  event: EventScoreCardModel
  relatedApproval: ApprovalScoreCardModel | null
  relatedRun: EventRunSummary | null
  factSummary: EventFactSummary
  decisionSummary: DecisionHeroSummary
  impactSummary: IndustryImpactSummary
  bestActionSummary: BestActionSummary
  evidenceSummary: EvidenceQualitySummary
  argumentSummaries: readonly ArgumentSummaryItem[]
  runtimeSummary: RuntimeSummary
  degradationNotices: readonly EventDegradationNotice[]
}

export interface EventAuditPageModel {
  event: EventScoreCardModel
  relatedApproval: ApprovalScoreCardModel | null
  relatedRun: EventRunSummary | null
  summary: AuditSummary
  timeline: readonly AuditTimelineItem[]
}

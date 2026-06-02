import type {
  AnalysisStatus,
  ApprovalScoreCardModel,
  EventDegradationNotice,
  EventScoreCardModel,
} from '@/features/event-scoring/types/event-scoring.types'
import type { RuntimeAgentRunSummary } from '@/features/mainflow/mock-data'

export interface EventFactSummary {
  source: string
  sourceAuthority: string
  publishedAt: string
  status: AnalysisStatus
  eventReliability: number
  verificationStatusLabel: string
  summary: string
}

export interface IndustryImpactSummary {
  industries: string[]
  impactDirection: string
  impactStrength: number
}

export interface BestActionSummary {
  actionHint: string
  analysisConfidence: number
  recommendationScore: number
  uncertaintySummary: string
  approvalStatus: string
  riskDirection?: string
  riskLevel?: string
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
  status: AnalysisStatus
  approvalId: string | null
  runId: string | null
}

export interface EventDetailPageModel {
  event: EventScoreCardModel
  relatedApproval: ApprovalScoreCardModel | null
  relatedRun: RuntimeAgentRunSummary | null
  factSummary: EventFactSummary
  impactSummary: IndustryImpactSummary
  bestActionSummary: BestActionSummary
  argumentSummaries: readonly ArgumentSummaryItem[]
  runtimeSummary: RuntimeSummary
  degradationNotices: readonly EventDegradationNotice[]
}

export interface EventAuditPageModel {
  event: EventScoreCardModel
  relatedApproval: ApprovalScoreCardModel | null
  relatedRun: RuntimeAgentRunSummary | null
  summary: AuditSummary
}

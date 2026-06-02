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
  actionTarget: string
  rationale: string
  triggerSummary: string
  analysisConfidence: number
  recommendationScore: number
  uncertaintySummary: string
  approvalStatus: string
  approvalId: string | null
  confirmationLevel: string | null
  expirationSummary: string | null
  riskDirection?: string
  riskLevel?: string
}

export interface DecisionHeroSummary {
  impactQuestion: string
  recommendedAction: string
  rationale: string
  currentBlocker: string
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
  status: AnalysisStatus
  approvalId: string | null
  runId: string | null
}

export interface EventDetailPageModel {
  event: EventScoreCardModel
  relatedApproval: ApprovalScoreCardModel | null
  relatedRun: RuntimeAgentRunSummary | null
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
  relatedRun: RuntimeAgentRunSummary | null
  summary: AuditSummary
}

export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'reanalysis_requested'

export type ApprovalRiskDirection = 'increase_risk' | 'reduce_risk' | 'neutral'

export type ApprovalConfirmationLevel =
  | 'strong_confirm'
  | 'link_confirm'
  | 'manual_only'

export type ApprovalExpirationAction =
  | 'expire_and_notify'
  | 'expire_and_archive'
  | 'expire_reanalysis'

export type ApprovalSortMode =
  | 'recommendation'
  | 'expires_soon'
  | 'highest_risk'
  | 'latest'

export type ApprovalActionType =
  | 'approve'
  | 'reject'
  | 'request_reanalysis'

export type ApprovalLinkStatus =
  | 'valid'
  | 'near_expiry'
  | 'expired'
  | 'used'
  | 'invalid'
  | 'permission_mismatch'

export interface ApprovalWorkbenchItem {
  id: string
  eventId: string
  eventTitle: string
  source: string
  actionLabel: string
  recommendationScore: number
  recommendationLabel: string
  eventCredibility: string
  analysisConfidence: string
  riskDirection: ApprovalRiskDirection
  riskLevel: '高' | '中' | '低'
  riskScore: number
  expiresInLabel: string
  expiresAtLabel: string
  expiresSoon: boolean
  expirationAction: ApprovalExpirationAction
  confirmationLevel: ApprovalConfirmationLevel
  triggerSummary: string
  status: ApprovalStatus
  createdAt: string
  createdOrder: number
  requiresSecondConfirm: boolean
  batchBlockReason?: string
  actionError?: {
    message: string
    requestId: string
    traceId: string
  } | null
}

export interface ApprovalActionPlanOrder {
  symbol: string
  side: string
  orderIntent: string
  notionalUsd: number | null
  portfolioPct: number | null
  orderType: string
  timeInForce: string
}

export interface ApprovalActionPlanRiskControls {
  stopLossPct: number | null
  takeProfitPct: number | null
  invalidationConditions: string[]
}

export interface ApprovalActionPlanMonitoring {
  watchSymbols: string[]
  watchTopics: string[]
  duration: string
}

export interface ApprovalActionPlanNotification {
  title: string
  summary: string
  deliveryPolicy: string
}

export interface ApprovalActionPlanSummary {
  artifactId: string
  summary: string
  intent: string
  intendedAction: string
  actionSide: ApprovalRiskDirection
  targetSymbols: string[]
  orders: ApprovalActionPlanOrder[]
  riskControls: ApprovalActionPlanRiskControls
  monitoringPlan: ApprovalActionPlanMonitoring
  userNotification: ApprovalActionPlanNotification
  constraints: string[]
  brokerMode: string
  idempotencyKey: string
}

export interface ApprovalWorkbenchDetail extends ApprovalWorkbenchItem {
  actionRequestSummary: Record<string, unknown>
  actionPlan: ApprovalActionPlanSummary | null
  allowedChannels: string[]
  policySource: string
  inputs: Array<Record<string, unknown>>
  evaluations: Array<Record<string, unknown>>
  decisions: Array<Record<string, unknown>>
  auditRefs: Array<Record<string, unknown>>
}

export interface ApprovalWorkbenchOverview {
  pendingCount: number
  expiringSoonCount: number
  highRiskCount: number
  strongConfirmationCount: number
}

export interface ApprovalWorkbenchSearch {
  confirmation?: ApprovalConfirmationLevel | 'all'
  riskDirection?: ApprovalRiskDirection | 'all'
  sort?: ApprovalSortMode
  status?: ApprovalStatus | 'all'
}

export interface ApprovalSelectionIssue {
  approvalId: string
  reason: string
}

export interface ApprovalBatchEligibility {
  eligibleIds: string[]
  issues: ApprovalSelectionIssue[]
}

export interface ApprovalActionResult {
  action: ApprovalActionType
  appliedIds: string[]
  failedIds: string[]
  failures: ApprovalActionFeedback[]
  message: string
}

export interface ApprovalActionFeedback {
  message: string
  requestId: string
  traceId: string
}

export interface ApprovalLinkContext {
  status: ApprovalLinkStatus
  approvalId: string
  eventId: string
  eventTitle: string
  actionLabel: string
  riskDirection: ApprovalRiskDirection
  riskLevel: '高' | '中' | '低'
  confirmationLevel: ApprovalConfirmationLevel
  expirationAction: ApprovalExpirationAction
  expiresInLabel: string
  triggerSummary: string
  requestId: string
  actionDisabled: boolean
  disabledReason?: string
}

import type {
  ApprovalActionResult,
  ApprovalActionType,
  ApprovalConfirmationLevel,
  ApprovalExpirationAction,
  ApprovalRiskDirection,
  ApprovalStatus,
  ApprovalActionPlanSummary,
  ApprovalWorkbenchDetail,
  ApprovalWorkbenchItem,
  ApprovalWorkbenchOverview,
  ApprovalWorkbenchSearch,
} from '../types/approval-workbench.types'
import { createApprovalWorkbenchOverview, filterApprovalWorkbenchItems, sortApprovalWorkbenchItems } from '../utils/approval-rules'

export interface ApprovalDecisionSummaryDto {
  status: string
  intent?: string | null
  reason_summary: string
  policy_gate_status: string
  execution_status: string
}

export interface ApprovalSummaryDto {
  id: string
  status: string
  target_type: string
  target_id: string
  action_type: string
  action_side: string
  risk_level: string
  urgency: string
  summary: string
  required_confirmation_level: string
  expires_at?: string | null
  expiration_action: string
  created_at?: string | null
  updated_at?: string | null
  latest_decision_summary?: ApprovalDecisionSummaryDto | null
  allowed_actions: string[]
}

export interface ApprovalDetailDto extends ApprovalSummaryDto {
  action_request_summary: Record<string, unknown>
  allowed_channels: string[]
  policy_source: string
  inputs: Array<Record<string, unknown>>
  evaluations: Array<Record<string, unknown>>
  decisions: Array<Record<string, unknown>>
  audit_refs: Array<Record<string, unknown>>
}

export interface ApprovalListResponseDto {
  items: ApprovalSummaryDto[]
  next_cursor?: string | null
}

export interface ApprovalActionRequestDto {
  channel: 'web'
  reason?: string
  comment?: string
  structured_payload: Record<string, unknown>
}

export interface ApprovalActionResponseDto {
  approval?: ApprovalSummaryDto | null
  decision?: ApprovalDecisionSummaryDto | null
  evaluation?: Record<string, unknown> | null
  ignored: boolean
}

export interface ApprovalWorkbenchListParams extends Record<string, boolean | number | string | null | undefined> {
  status?: string
  risk_level?: string
  required_confirmation_level?: string
  sort?: string
  limit?: number
}

export function toApprovalWorkbenchListParams(search: ApprovalWorkbenchSearch): ApprovalWorkbenchListParams {
  return {
    status: search.status && search.status !== 'all' ? toApiStatus(search.status) : undefined,
    required_confirmation_level: search.confirmation && search.confirmation !== 'all' ? search.confirmation : undefined,
    sort: toApiSort(search.sort),
    limit: 100,
  }
}

export function mapApprovalListResponse(
  response: ApprovalListResponseDto,
  search: ApprovalWorkbenchSearch,
): ApprovalWorkbenchItem[] {
  const items = response.items.map(mapApprovalSummary)
  return sortApprovalWorkbenchItems(filterApprovalWorkbenchItems(items, search), search.sort ?? 'recommendation')
}

export function mapApprovalOverview(response: ApprovalListResponseDto): ApprovalWorkbenchOverview {
  return createApprovalWorkbenchOverview(response.items.map(mapApprovalSummary))
}

export function mapApprovalSummary(dto: ApprovalSummaryDto): ApprovalWorkbenchItem {
  const createdAt = dto.created_at ?? dto.updated_at ?? ''
  const expiresAt = dto.expires_at ?? ''
  const riskScore = riskScoreFromLevel(dto.risk_level)
  return {
    id: dto.id,
    eventId: dto.target_id,
    eventTitle: `${dto.target_id} ${dto.action_type}`,
    source: dto.target_type,
    actionLabel: actionLabel(dto),
    recommendationScore: dto.latest_decision_summary?.status === 'pending' ? 78 : 60,
    recommendationLabel: dto.latest_decision_summary?.reason_summary ?? dto.summary,
    eventCredibility: 'policy_source' in dto && typeof dto.policy_source === 'string' ? dto.policy_source : 'approval_policy',
    analysisConfidence: dto.latest_decision_summary?.policy_gate_status ?? 'pending',
    riskDirection: toRiskDirection(dto.action_side),
    riskLevel: riskLabel(dto.risk_level),
    riskScore,
    expiresInLabel: expiresAt ? '等待到期' : '无到期时间',
    expiresAtLabel: expiresAt || '未设置',
    expiresSoon: false,
    expirationAction: toExpirationAction(dto.expiration_action),
    confirmationLevel: toConfirmationLevel(dto.required_confirmation_level),
    triggerSummary: dto.summary,
    status: toUiStatus(dto.status, dto.latest_decision_summary?.status),
    createdAt,
    createdOrder: createdAt ? Date.parse(createdAt) || 0 : 0,
    requiresSecondConfirm: dto.required_confirmation_level === 'strong_confirm',
    batchBlockReason: dto.required_confirmation_level === 'manual_only' ? 'manual_only 只能逐条处理' : undefined,
    actionError: null,
  }
}

export function mapApprovalDetail(dto: ApprovalDetailDto): ApprovalWorkbenchDetail {
  return {
    ...mapApprovalSummary(dto),
    actionRequestSummary: dto.action_request_summary,
    actionPlan: mapActionPlanSummary(dto.action_request_summary),
    allowedChannels: dto.allowed_channels,
    policySource: dto.policy_source,
    inputs: dto.inputs,
    evaluations: dto.evaluations,
    decisions: dto.decisions,
    auditRefs: dto.audit_refs,
  }
}

export function toApprovalActionPayload(action: ApprovalActionType, reason?: string): ApprovalActionRequestDto {
  return {
    channel: 'web',
    reason,
    structured_payload: { intent: action },
  }
}

export function mapApprovalActionResponse(
  action: ApprovalActionType,
  approvalIds: string[],
  responses: ApprovalActionResponseDto[],
): ApprovalActionResult {
  const failedIds = responses
    .map((response, index) => ({ response, approvalId: approvalIds[index] }))
    .filter(({ response }) => response.ignored || response.decision?.status === 'ignored')
    .map(({ approvalId }) => approvalId)
  return {
    action,
    appliedIds: approvalIds.filter((approvalId) => !failedIds.includes(approvalId)),
    failedIds,
    failures: failedIds.map((approvalId) => ({
      message: 'approval_action_ignored',
      requestId: `req-${approvalId}`,
      traceId: `trace-${approvalId}`,
    })),
    message: 'approval_action_submitted',
  }
}

function actionLabel(dto: ApprovalSummaryDto): string {
  return `${dto.action_side} ${dto.target_id}`
}

function toRiskDirection(value: string): ApprovalRiskDirection {
  if (value === 'increase_risk' || value === 'reduce_risk') return value
  return 'neutral'
}

function riskLabel(value: string): ApprovalWorkbenchItem['riskLevel'] {
  if (value === 'high' || value === 'critical') return '高'
  if (value === 'medium') return '中'
  return '低'
}

function riskScoreFromLevel(value: string): number {
  if (value === 'high' || value === 'critical') return 90
  if (value === 'medium') return 65
  return 35
}

function toConfirmationLevel(value: string): ApprovalConfirmationLevel {
  if (value === 'strong_confirm' || value === 'link_confirm' || value === 'manual_only') return value
  return 'strong_confirm'
}

function toExpirationAction(value: string): ApprovalExpirationAction {
  if (value === 'expire_reanalysis') return 'expire_reanalysis'
  if (value === 'expire_notify_only') return 'expire_and_notify'
  return 'expire_and_archive'
}

function toUiStatus(status: string, decisionStatus?: string | null): ApprovalStatus {
  if (status === 'pending') return 'pending'
  if (status === 'expired') return 'expired'
  if (decisionStatus === 'approved' || decisionStatus === 'execution_requested') return 'approved'
  if (decisionStatus === 'reanalysis_requested') return 'reanalysis_requested'
  if (decisionStatus === 'rejected' || decisionStatus === 'blocked' || decisionStatus === 'policy_blocked') return 'rejected'
  return 'rejected'
}

function toApiStatus(status: ApprovalStatus): string {
  if (status === 'approved' || status === 'rejected' || status === 'reanalysis_requested') return 'completed'
  return status
}

function toApiSort(sort: ApprovalWorkbenchSearch['sort']): string {
  if (sort === 'latest') return '-updated_at'
  if (sort === 'expires_soon') return 'expires_at'
  return '-updated_at'
}

function mapActionPlanSummary(actionRequestSummary: Record<string, unknown>): ApprovalActionPlanSummary | null {
  const proposedPayload = toRecord(actionRequestSummary.proposed_payload_summary) ?? {}
  const plan = toRecord(proposedPayload.action_plan_summary)
  const fallbackOrder = toRecord(proposedPayload.order_summary)
  if (!plan && !fallbackOrder) return null

  return {
    artifactId: toText(plan?.action_plan_artifact_id),
    summary: toText(plan?.summary ?? proposedPayload.summary),
    intent: toText(plan?.intent),
    intendedAction: toText(plan?.intended_action),
    actionSide: toRiskDirection(toText(plan?.action_side ?? actionRequestSummary.action_side)),
    targetSymbols: toTextList(plan?.target_symbols),
    orders: mapOrders(plan?.orders, fallbackOrder),
    riskControls: mapRiskControls(plan?.risk_controls ?? proposedPayload.risk_controls),
    monitoringPlan: mapMonitoringPlan(plan?.monitoring_plan ?? proposedPayload.monitoring_plan),
    userNotification: mapNotification(plan?.user_notification ?? proposedPayload.notification_summary),
    constraints: toTextList(plan?.constraints),
    brokerMode: toText(proposedPayload.broker_mode),
    idempotencyKey: toText(proposedPayload.idempotency_key),
  }
}

function mapOrders(value: unknown, fallbackOrder: Record<string, unknown> | null) {
  const orders = toRecordList(value)
  const source = orders.length > 0 ? orders : fallbackOrder ? [fallbackOrder] : []
  return source.map((order) => ({
    symbol: toText(order.symbol),
    side: toText(order.side),
    orderIntent: toText(order.order_intent),
    notionalUsd: toNumber(order.notional_usd),
    portfolioPct: toNumber(order.portfolio_pct),
    orderType: toText(order.order_type),
    timeInForce: toText(order.time_in_force),
  }))
}

function mapRiskControls(value: unknown) {
  const riskControls = toRecord(value)
  return {
    stopLossPct: toNumber(riskControls?.stop_loss_pct),
    takeProfitPct: toNumber(riskControls?.take_profit_pct),
    invalidationConditions: toTextList(riskControls?.invalidation_conditions),
  }
}

function mapMonitoringPlan(value: unknown) {
  const monitoringPlan = toRecord(value)
  return {
    watchSymbols: toTextList(monitoringPlan?.watch_symbols),
    watchTopics: toTextList(monitoringPlan?.watch_topics),
    duration: toText(monitoringPlan?.duration),
  }
}

function mapNotification(value: unknown) {
  const notification = toRecord(value)
  return {
    title: toText(notification?.title),
    summary: toText(notification?.summary),
    deliveryPolicy: toText(notification?.delivery_policy),
  }
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function toRecordList(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.flatMap((item) => (toRecord(item) ? [toRecord(item)!] : [])) : []
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function toTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const text = toText(item).trim()
    return text ? [text] : []
  })
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

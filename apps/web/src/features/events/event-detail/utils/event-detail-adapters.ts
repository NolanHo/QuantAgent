import { formatVerificationStatus } from '@/features/event-scoring/utils/event-scoring-labels'
import type {
  ApprovalScoreCardModel,
  AnalysisStatus,
  EventScoreCardModel,
} from '@/features/event-scoring/types/event-scoring.types'

import type {
  AuditTimelineItem,
  EventRunSummary,
  EventAuditPageModel,
  EventDetailPageModel,
} from '../types/event-detail.types'

function buildAffectedObjects(event: EventScoreCardModel) {
  const industryObjects = event.industries.map((industry) => `${industry}链`)
  const directionObject = event.impactDirection.replace(/偏多|偏空|旧闻|需要受控放行/g, '').trim()

  return Array.from(
    new Set([
      ...industryObjects,
      directionObject ? `${directionObject}相关标的` : null,
    ].filter((item): item is string => Boolean(item))),
  )
}

function buildImpactWindow(event: EventScoreCardModel) {
  if (event.score.freshness === 'high') {
    return event.publishedMinutesAgo <= 120
      ? '高时效窗口，优先看未来数小时到 1 个交易日'
      : '仍在高时效窗口，优先看未来 1 到 2 个交易日'
  }

  if (event.score.freshness === 'medium') {
    return '中等时效窗口，优先看未来 2 到 3 个交易日的验证反馈'
  }

  return '事件窗口已明显衰减，当前主要保留审计和解释价值'
}

function buildRiskPoints(
  event: EventScoreCardModel,
  approval: ApprovalScoreCardModel | null,
) {
  const noticeSummaries = event.degradationNotices.map((notice) => notice.summary)

  return [
    event.score.uncertaintySummary,
    approval?.scoreContext.riskLevel ? `审批风险等级：${approval.scoreContext.riskLevel}` : null,
    ...noticeSummaries,
  ].filter((item): item is string => Boolean(item))
}

function buildEvidenceQuality(event: EventScoreCardModel) {
  if (event.score.verificationStatus === 'dual_verified') {
    return '证据质量较高：已完成双信源交叉验证，但仍需跟踪后续政策或产业反馈。'
  }

  if (event.score.verificationStatus === 'conflicting_sources') {
    return '证据质量受限：正式口径与渠道信号冲突，需要人工确认后再进入后续链路。'
  }

  if (event.score.verificationStatus === 'single_source') {
    return '证据质量偏弱：当前仍是单信源，不足以支撑强动作。'
  }

  if (event.score.verificationStatus === 'invalid_output') {
    return '证据质量无效：分析输出不可用，应先恢复工具链或请求重分析。'
  }

  return '证据质量待补：仍需补齐交叉信源与关键业务指标。'
}

function formatAnalysisStatusLabel(status: AnalysisStatus) {
  switch (status) {
    case 'captured':
      return '已捕获，等待分析'
    case 'analyzing':
      return '分析中'
    case 'decision_ready':
      return '分析已完成'
    case 'pending_approval':
      return '等待人工审批'
    case 'warning':
      return '运行提醒'
    case 'analysis_failed':
      return '分析失败'
    case 'policy_blocked':
      return '策略门禁阻断'
    default:
      return status
  }
}

function formatRuntimeStatusLabel(status: string) {
  switch (status) {
    case 'succeeded':
      return '运行完成'
    case 'output_invalid':
      return '输出校验失败'
    case 'timed_out':
      return '运行超时'
    case 'failed':
      return '运行失败'
    default:
      return formatAnalysisStatusLabel(status as AnalysisStatus)
  }
}

function formatProviderPolicyLabel(policy: string | undefined) {
  switch (policy) {
    case 'balanced':
      return '平衡策略'
    case 'reasoning':
      return '深度推理策略'
    case undefined:
      return '待补充'
    default:
      return policy
  }
}

function formatConfirmationLevelLabel(level: string | undefined) {
  switch (level) {
    case 'strong_confirm':
      return '强确认'
    case 'manual_only':
      return '仅人工复核'
    case 'link_confirm':
      return '链接确认'
    case undefined:
      return null
    default:
      return level
  }
}

function formatRiskDirectionLabel(direction: string | undefined) {
  switch (direction) {
    case 'increase_risk':
      return '风险上升'
    case 'reduce_risk':
      return '降低风险暴露'
    case 'neutral':
      return '中性复核'
    case undefined:
      return undefined
    default:
      return direction
  }
}

function buildDivergenceSummary(event: EventScoreCardModel) {
  if (event.score.verificationStatus === 'conflicting_sources') {
    return event.analysisHighlights?.verificationNote ?? '当前存在多信源冲突，建议保持人工复核。'
  }

  if (event.industries.length > 1) {
    return `分歧主要来自 ${event.industries.join(' / ')} 对同一事件的兑现节奏不同。`
  }

  return event.score.uncertaintySummary
}

function buildApprovalStatus(
  approval: ApprovalScoreCardModel | null,
) {
  if (!approval) {
    return '当前暂无审批请求'
  }

  return `已生成审批请求：${formatConfirmationLevelLabel(approval.scoreContext.confirmationLevel) ?? '待确认'}`
}

function buildAuditTimeline(
  event: EventScoreCardModel,
  approval: ApprovalScoreCardModel | null,
  run: EventRunSummary | null,
): readonly AuditTimelineItem[] {
  const capturedAt = event.publishedAt.split(' ').at(1) ?? event.publishedAt
  const items: AuditTimelineItem[] = [
    {
      title: `事件捕获 · ${capturedAt}`,
      copy: `${event.source} 捕获事件，当前状态为${formatAnalysisStatusLabel(event.status)}。`,
    },
  ]

  if (run) {
    items.push({
      title: '运行分析',
      copy: `${formatRuntimeStatusLabel(run.status)}，耗时 ${run.duration}。${run.summary}`,
    })
  } else if (event.status === 'analysis_failed') {
    items.push({
      title: '分析未完成',
      copy: event.score.uncertaintySummary,
    })
  }

  if (approval) {
    items.push({
      title: '审批请求',
      copy: `${approval.actionLabel}，确认等级为${formatConfirmationLevelLabel(approval.scoreContext.confirmationLevel) ?? '待确认'}，确认窗口 ${approval.scoreContext.expiresIn}。`,
    })
  } else {
    items.push({
      title: '未生成审批请求',
      copy: event.status === 'captured'
        ? '当前只保留事件事实和审计入口，未进入建议动作审批链路。'
        : '当前没有关联人工审批请求。',
    })
  }

  event.degradationNotices.forEach((notice) => {
    items.push({
      title: `降级提示 · ${notice.title}`,
      copy: notice.summary,
    })
  })

  return items
}

export function createEventDetailPageModel(
  event: EventScoreCardModel,
  approval: ApprovalScoreCardModel | null,
  run: EventRunSummary | null,
): EventDetailPageModel {
  const verificationStatusLabel = formatVerificationStatus(event.score.verificationStatus)
  const approvalActionLabel = approval?.actionLabel ?? event.actionHint
  const affectedObjects = buildAffectedObjects(event)
  const riskPoints = buildRiskPoints(event, approval)
  const evidenceQuality = buildEvidenceQuality(event)
  const verificationNote = event.analysisHighlights?.verificationNote
    ?? `当前为 ${verificationStatusLabel}，需要继续补齐交叉信源。`
  const dataGap = event.degradationNotices.length > 0
    ? event.degradationNotices.map((item) => item.title).join(' / ')
    : event.score.uncertaintySummary

  // 中文注释：评分用于解释事件与建议质量，不代表已经获得执行放行。
  return {
    event,
    relatedApproval: approval,
    relatedRun: run,
    factSummary: {
      source: event.source,
      sourceAuthority: event.score.sourceAuthority,
      publishedAt: event.publishedAt,
      status: formatAnalysisStatusLabel(event.status),
      eventReliability: event.score.eventReliability,
      verificationStatusLabel,
      summary: event.summary,
    },
    decisionSummary: {
      impactQuestion: `${event.impactDirection}，重点影响 ${affectedObjects.join('、') || event.industries.join('、')}。`,
      recommendedAction: approvalActionLabel,
      rationale: approval?.triggerSummary ?? event.score.selectionReason,
      currentBlocker: approval
        ? `必须先进入${formatConfirmationLevelLabel(approval.scoreContext.confirmationLevel) ?? '人工确认'}审批链路，不能在详情页直接执行。`
        : event.score.uncertaintySummary,
    },
    impactSummary: {
      industries: event.industries,
      affectedObjects,
      impactDirection: event.impactDirection,
      impactStrength: event.score.impactStrength,
      impactWindow: buildImpactWindow(event),
      riskPoints,
      consensusSummary: event.analysisHighlights?.support ?? event.score.selectionReason,
      divergenceSummary: buildDivergenceSummary(event),
    },
    bestActionSummary: {
      actionTitle: approvalActionLabel,
      actionHint: event.actionHint,
      actionTarget: affectedObjects[0] ?? event.industries[0] ?? '待补充',
      rationale: approval?.triggerSummary ?? event.score.selectionReason,
      triggerSummary: approval?.triggerSummary ?? `由 ${event.score.selectionReason} 触发。`,
      analysisConfidence: event.score.analysisConfidence,
      recommendationScore: event.score.recommendationScore,
      uncertaintySummary: event.score.uncertaintySummary,
      approvalStatus: buildApprovalStatus(approval),
      approvalId: approval?.id ?? null,
      confirmationLevel: formatConfirmationLevelLabel(approval?.scoreContext.confirmationLevel),
      expirationSummary: approval
        ? `${approval.scoreContext.expiresIn}，${approval.scoreContext.expirationAction}`
        : null,
      riskDirection: formatRiskDirectionLabel(approval?.scoreContext.riskDirection),
      riskLevel: approval?.scoreContext.riskLevel,
    },
    evidenceSummary: {
      support: event.analysisHighlights?.support ?? '当前事件暂无额外支持观点摘要。',
      opposition: event.analysisHighlights?.opposition ?? '当前事件暂无额外反方观点摘要。',
      evidenceQuality,
      dataGap,
      verificationNote,
    },
    argumentSummaries: [
      ['支持观点', event.analysisHighlights?.support ?? '当前事件暂无额外支持观点摘要。'],
      ['反方观点', event.analysisHighlights?.opposition ?? '当前事件暂无额外反方观点摘要。'],
      ['证据质量', evidenceQuality],
      ['验证状态', verificationNote],
      ['数据缺口', dataGap],
      ['降级摘要', event.degradationNotices.map((item) => item.title).join(' / ') || '当前无降级提示'],
    ].map(([label, text]) => ({ label, text })),
    runtimeSummary: {
      runId: run?.id ?? null,
      status: run ? formatRuntimeStatusLabel(run.status) : formatAnalysisStatusLabel(event.status),
      providerPolicy: formatProviderPolicyLabel(run?.providerPolicy),
      traceId: run?.traceId ?? '待补充',
      summary: run?.summary ?? '当前暂无关联运行摘要。',
    },
    degradationNotices: event.degradationNotices,
  }
}

export function createEventAuditPageModel(
  event: EventScoreCardModel,
  approval: ApprovalScoreCardModel | null,
  run: EventRunSummary | null,
): EventAuditPageModel {
  return {
    event,
    relatedApproval: approval,
    relatedRun: run,
    summary: {
      eventReliability: event.score.eventReliability,
      impactStrength: event.score.impactStrength,
      status: formatAnalysisStatusLabel(event.status),
      approvalId: approval?.id ?? null,
      runId: run?.id ?? null,
    },
    timeline: buildAuditTimeline(event, approval, run),
  }
}

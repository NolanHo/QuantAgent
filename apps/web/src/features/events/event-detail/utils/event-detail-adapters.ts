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

function buildDivergenceSummary(event: EventScoreCardModel) {
  if (event.score.verificationStatus === 'conflicting_sources') {
    return event.analysisHighlights?.verificationNote ?? '当前存在多信源冲突，建议保持人工复核。'
  }

  if (event.industries.length > 1) {
    return `分歧主要来自 ${event.industries.join(' / ')} 对同一事件的兑现节奏不同。`
  }

  return event.score.uncertaintySummary
}

function buildInvestmentActionTitle(
  event: EventScoreCardModel,
  approval: ApprovalScoreCardModel | null,
) {
  if (approval?.actionLabel) {
    return approval.actionLabel
  }

  if (event.status === 'analysis_failed') {
    return '先暂停交易判断，等待重分析'
  }

  if (event.score.freshness === 'low') {
    return '不追旧闻，只保留复盘'
  }

  if (event.impactDirection.includes('偏空')) {
    return `降低${event.industries[0] ?? '相关产业'}暴露`
  }

  if (event.impactDirection.includes('偏多')) {
    return `观察${event.industries[0] ?? '相关产业'}做多确认信号`
  }

  return event.actionHint
}

function buildInvestorImpactSummary(event: EventScoreCardModel, affectedObjects: readonly string[]) {
  const target = event.industries.join('、') || affectedObjects[0] || '相关产业链'

  if (event.status === 'analysis_failed') {
    return `${target}存在信号，但当前分析链路不完整，不适合直接形成交易动作。`
  }

  if (event.impactDirection.includes('偏空')) {
    return `${target}短线承压，优先检查相关股票仓位、盈利假设和对冲需求。`
  }

  if (event.impactDirection.includes('偏多')) {
    return `${target}可能受益，但需要先确认价格、订单或需求信号是否同步。`
  }

  return `${target}需要继续复核，不把单条事件直接等同于买卖结论。`
}

function buildInvestorRationale(
  event: EventScoreCardModel,
) {
  const support = event.analysisHighlights?.support ?? event.score.selectionReason

  return `${support} ${event.score.uncertaintySummary}`
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
  const affectedObjects = buildAffectedObjects(event)
  const riskPoints = buildRiskPoints(event, approval)
  const evidenceQuality = buildEvidenceQuality(event)
  const investmentActionTitle = buildInvestmentActionTitle(event, approval)
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
      impactQuestion: buildInvestorImpactSummary(event, affectedObjects),
      recommendedAction: investmentActionTitle,
      rationale: buildInvestorRationale(event),
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
      actionTitle: investmentActionTitle,
      actionHint: event.actionHint,
      analysisConfidence: event.score.analysisConfidence,
      recommendationScore: event.score.recommendationScore,
      approvalId: approval?.id ?? null,
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

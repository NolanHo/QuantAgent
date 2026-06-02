import { formatVerificationStatus } from '@/features/event-scoring/utils/event-scoring-labels'
import type {
  ApprovalScoreCardModel,
  EventScoreCardModel,
} from '@/features/event-scoring/types/event-scoring.types'
import type { RuntimeAgentRunSummary } from '@/features/mainflow/mock-data'

import type {
  EventAuditPageModel,
  EventDetailPageModel,
} from '../types/event-detail.types'

function buildApprovalStatus(
  approval: ApprovalScoreCardModel | null,
) {
  if (!approval) {
    return '当前暂无 ApprovalRequest'
  }

  return `已生成 ${approval.scoreContext.confirmationLevel}`
}

export function createEventDetailPageModel(
  event: EventScoreCardModel,
  approval: ApprovalScoreCardModel | null,
  run: RuntimeAgentRunSummary | null,
): EventDetailPageModel {
  const verificationStatusLabel = formatVerificationStatus(event.score.verificationStatus)

  // 中文注释：评分用于解释事件与建议质量，不代表已经获得执行放行。
  return {
    event,
    relatedApproval: approval,
    relatedRun: run,
    factSummary: {
      source: event.source,
      sourceAuthority: event.score.sourceAuthority,
      publishedAt: event.publishedAt,
      status: event.status,
      eventReliability: event.score.eventReliability,
      verificationStatusLabel,
      summary: event.summary,
    },
    impactSummary: {
      industries: event.industries,
      impactDirection: event.impactDirection,
      impactStrength: event.score.impactStrength,
    },
    bestActionSummary: {
      actionHint: event.actionHint,
      analysisConfidence: event.score.analysisConfidence,
      recommendationScore: event.score.recommendationScore,
      uncertaintySummary: event.score.uncertaintySummary,
      approvalStatus: buildApprovalStatus(approval),
      riskDirection: approval?.scoreContext.riskDirection,
      riskLevel: approval?.scoreContext.riskLevel,
    },
    argumentSummaries: [
      ['支持观点', event.analysisHighlights?.support ?? '当前事件暂无额外支持观点摘要。'],
      ['反方观点', event.analysisHighlights?.opposition ?? '当前事件暂无额外反方观点摘要。'],
      ['验证状态', event.analysisHighlights?.verificationNote ?? `当前为 ${verificationStatusLabel}，需要继续补齐交叉信源。`],
      ['数据缺口', event.score.uncertaintySummary],
      ['降级摘要', event.degradationNotices.map((item) => item.title).join(' / ') || '当前无降级提示'],
    ].map(([label, text]) => ({ label, text })),
    runtimeSummary: {
      runId: run?.id ?? null,
      status: run?.status ?? event.status,
      providerPolicy: run?.providerPolicy ?? '待补充',
      traceId: run?.traceId ?? '待补充',
      summary: run?.summary ?? '当前暂无关联 Agent Run 摘要。',
    },
    degradationNotices: event.degradationNotices,
  }
}

export function createEventAuditPageModel(
  event: EventScoreCardModel,
  approval: ApprovalScoreCardModel | null,
  run: RuntimeAgentRunSummary | null,
): EventAuditPageModel {
  return {
    event,
    relatedApproval: approval,
    relatedRun: run,
    summary: {
      eventReliability: event.score.eventReliability,
      impactStrength: event.score.impactStrength,
      status: event.status,
      approvalId: approval?.id ?? null,
      runId: run?.id ?? null,
    },
  }
}

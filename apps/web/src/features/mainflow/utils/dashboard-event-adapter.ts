import type { DashboardEventCardModel, DashboardEventSource, DashboardEventsSummary } from '../types/dashboard-event.types'

const DEFAULT_DASHBOARD_EVENT_LIMIT = 3
const MINUTE_MS = 60_000

export function toDashboardEventsSummary(
  events: readonly DashboardEventSource[],
  limit = DEFAULT_DASHBOARD_EVENT_LIMIT,
): DashboardEventsSummary {
  const items = events
    .filter((event) => event.decision !== 'discard')
    .map(toDashboardEventCardModel)
    .sort((left, right) => right.score.eventPriority - left.score.eventPriority)
    .slice(0, limit)

  return {
    items,
    total: events.length,
  }
}

export function toDashboardEventCardModel(event: DashboardEventSource): DashboardEventCardModel {
  const confidence = firstPercent(
    event.quality.confidence,
    event.quality.event_reliability,
    event.router_stage_summary.key_fields.confidence,
  )
  const relevance = parseRelationshipScore(event.relationship_summary)
  const priorityScore = priorityToScore(event.priority)
  const reliability = confidence ?? relevance ?? priorityScore
  const topicLabels = [...event.target_industries, ...event.target_topics, ...event.tags].filter(Boolean)
  const freshness = freshnessFromMinutes(minutesSince(event.published_at))
  const status = analysisStatus(event)

  // 中文注释：当前后端只提供 Router read model，首页评分摘要只从真实字段推导，不伪造 MainAgent 影响评分。
  return {
    id: event.raw_event_id,
    eventId: event.raw_event_id,
    title: event.title ?? event.raw_event_id,
    source: event.source_name ?? event.source_plugin_id ?? '未知来源',
    sourceType: event.source_plugin_id ?? 'Router read model',
    publishedAt: event.published_at ?? event.timeline[0]?.occurred_at?.toString() ?? '',
    publishedMinutesAgo: minutesSince(event.published_at),
    status,
    summary: event.summary ?? event.router_stage_summary.summary,
    actionHint: actionHint(event),
    industries: topicLabels.length > 0 ? topicLabels.slice(0, 4) : ['待行业归因'],
    impactDirection: event.decision === 'review' ? 'Router 建议人工复核' : '行业影响待 MainAgent',
    score: {
      sourceAuthority: sourceAuthority(reliability),
      eventReliability: reliability,
      impactStrength: impactStrength(event, reliability),
      freshness,
      eventPriority: dashboardPriorityScore(event, priorityScore, reliability, freshness),
      priorityBand: priorityToBand(event.priority),
      verificationStatus: verificationStatus(event, confidence, relevance),
      analysisConfidence: confidence ?? 0,
      recommendationScore: event.decision === 'route' ? Math.round((priorityScore + reliability) / 2) : 0,
      uncertaintySummary: event.decision === 'review' ? 'Router Agent 要求人工复核后再进入后续分析。' : '行业 MainAgent 影响评分尚未接入。',
      selectionReason: selectionReason(event, reliability),
    },
    degradationNotices: degradationNotices(event, confidence),
    analysisHighlights: {
      support: event.router_stage_summary.summary,
      opposition: event.decision === 'review' ? '该事件仍需人工复核，不能直接作为后续动作依据。' : '当前只完成 Router 阶段，行业影响和建议仍待后续 read model。',
      verificationNote: verificationNote(confidence, relevance),
    },
  }
}

function actionHint(event: DashboardEventSource): string {
  if (event.decision === 'review') {
    return '先复核 Router 关键字段，再决定是否进入行业分析。'
  }

  if (event.status === 'failed') {
    return '先查看 Router 失败摘要和 trace，再决定是否重跑。'
  }

  return '进入事件详情查看 Router 输出和审计链路。'
}

function dashboardPriorityScore(
  event: DashboardEventSource,
  priorityScore: number,
  reliability: number,
  freshness: DashboardEventCardModel['score']['freshness'],
): number {
  const freshnessBoost = freshness === 'high' ? 5 : freshness === 'medium' ? 0 : -8
  const reviewPenalty = event.decision === 'review' ? -8 : 0
  const failedPenalty = event.status === 'failed' ? -18 : 0

  return clampScore(Math.round(priorityScore * 0.62 + reliability * 0.38 + freshnessBoost + reviewPenalty + failedPenalty))
}

function impactStrength(event: DashboardEventSource, reliability: number): number {
  if (event.decision === 'review') return clampScore(Math.round(reliability * 0.72))
  if (event.target_industries.length > 0 || event.target_topics.length > 0) return clampScore(Math.round(reliability * 0.86))
  return clampScore(Math.round(reliability * 0.66))
}

function selectionReason(event: DashboardEventSource, reliability: number): string {
  const priority = event.priority ? `priority=${event.priority}` : 'priority 未给出'
  const confidence = `可信度 ${reliability}`
  const target = event.target_industries[0] ?? event.target_topics[0] ?? '待行业归因'
  return `${priority} · ${confidence} · ${target}`
}

function verificationNote(confidence: number | null, relevance: number | null): string {
  const confidenceText = confidence === null ? '可信度未给出' : `可信度 ${confidence}`
  const relevanceText = relevance === null ? '相关性未给出' : `相关性 ${relevance}`
  return `${confidenceText}，${relevanceText}，当前以 Router read model 为真源。`
}

function degradationNotices(event: DashboardEventSource, confidence: number | null): DashboardEventCardModel['degradationNotices'] {
  const notices: Array<DashboardEventCardModel['degradationNotices'][number]> = []

  if (event.status === 'failed') {
    notices.push({
      kind: 'invalid_analysis',
      title: 'Router 输出失败',
      summary: event.router_stage_summary.summary,
      requestId: event.trace.request_id ?? undefined,
    })
  }

  if (event.decision === 'review') {
    notices.push({
      kind: 'weak_source',
      title: '需要复核',
      summary: 'Router Agent 未直接放入 route 队列，需要人工检查关键字段。',
      traceId: event.trace.correlation_id ?? undefined,
    })
  }

  if (confidence !== null && confidence < 55) {
    notices.push({
      kind: 'weak_source',
      title: '可信度偏低',
      summary: '后端 Router read model 给出的可信度偏低，首页不会把它当作稳定分析结论。',
    })
  }

  return notices
}

function verificationStatus(
  event: DashboardEventSource,
  confidence: number | null,
  relevance: number | null,
): DashboardEventCardModel['score']['verificationStatus'] {
  if (event.status === 'failed') return 'invalid_output'
  if (event.decision === 'review') return 'awaiting_verification'
  if ((confidence ?? 0) >= 75 && (relevance ?? confidence ?? 0) >= 70) return 'dual_verified'
  if ((confidence ?? 0) < 55) return 'single_source'
  return 'awaiting_verification'
}

function analysisStatus(event: DashboardEventSource): DashboardEventCardModel['status'] {
  if (event.status === 'failed') return 'analysis_failed'
  if (event.decision === 'review') return 'warning'
  return 'decision_ready'
}

function priorityToScore(priority: string | null): number {
  if (priority === 'urgent') return 95
  if (priority === 'high') return 85
  if (priority === 'normal') return 70
  if (priority === 'low') return 45
  return 60
}

function priorityToBand(priority: string | null): DashboardEventCardModel['score']['priorityBand'] {
  if (priority === 'urgent') return 'S'
  if (priority === 'high') return 'A'
  if (priority === 'normal') return 'B'
  return 'C'
}

function sourceAuthority(score: number): DashboardEventCardModel['score']['sourceAuthority'] {
  if (score >= 90) return 'S'
  if (score >= 75) return 'A'
  if (score >= 55) return 'B'
  return 'C'
}

function freshnessFromMinutes(minutes: number): DashboardEventCardModel['score']['freshness'] {
  if (minutes <= 180) return 'high'
  if (minutes <= 1_440) return 'medium'
  return 'low'
}

function minutesSince(value: string | null): number {
  if (!value) return 0
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 0
  return Math.max(0, Math.round((Date.now() - date.getTime()) / MINUTE_MS))
}

function firstPercent(...values: unknown[]): number | null {
  for (const value of values) {
    const percent = toPercent(value)
    if (percent !== null) return percent
  }

  return null
}

function toPercent(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  return clampScore(Math.round(value <= 1 ? value * 100 : value))
}

function parseRelationshipScore(value: string | null): number | null {
  if (!value) return null
  const match = value.match(/(?:^|\/\s*)(0(?:\.\d+)?|1(?:\.0+)?|[1-9]\d?)(?:\s*$)/)
  if (!match) return null
  const numeric = Number(match[1])
  if (Number.isNaN(numeric)) return null
  return clampScore(Math.round(numeric <= 1 ? numeric * 100 : numeric))
}

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, value))
}

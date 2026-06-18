import type { EventListItem } from '@/features/events'

export interface DashboardEventCardModel {
  id: string
  eventId: string
  title: string
  source: string
  sourceType: string
  publishedAt: string
  publishedMinutesAgo: number
  status: 'captured' | 'analyzing' | 'decision_ready' | 'pending_approval' | 'warning' | 'analysis_failed' | 'policy_blocked'
  summary: string
  actionHint: string
  industries: string[]
  impactDirection: string
  score: {
    sourceAuthority: 'A' | 'B' | 'C' | 'S'
    eventReliability: number
    impactStrength: number
    freshness: 'high' | 'medium' | 'low'
    eventPriority: number
    priorityBand: 'A' | 'B' | 'C' | 'S'
    verificationStatus: 'single_source' | 'dual_verified' | 'conflicting_sources' | 'awaiting_verification' | 'invalid_output'
    analysisConfidence: number
    recommendationScore: number
    uncertaintySummary: string
    selectionReason: string
  }
  degradationNotices: readonly {
    kind: 'weak_source' | 'conflicting_sources' | 'tool_failure' | 'invalid_analysis' | 'stale_event' | 'policy_blocked'
    title: string
    summary: string
    requestId?: string
    traceId?: string
  }[]
  analysisHighlights?: {
    support: string
    opposition: string
    verificationNote?: string
  }
}

export interface DashboardEventsSummary {
  items: readonly DashboardEventCardModel[]
  total: number
}

export type DashboardEventSource = Pick<
  EventListItem,
  | 'raw_event_id'
  | 'title'
  | 'summary'
  | 'source_name'
  | 'source_plugin_id'
  | 'published_at'
  | 'decision'
  | 'status'
  | 'priority'
  | 'relationship_summary'
  | 'target_industries'
  | 'target_topics'
  | 'tags'
  | 'quality'
  | 'trace'
  | 'timeline'
  | 'router_stage_summary'
>

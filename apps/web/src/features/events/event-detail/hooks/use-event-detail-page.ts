import {
  scoredApprovals,
  scoredEvents,
} from '@/features/event-scoring/mocks/event-scoring.mock'
import { runtimeAgentRuns } from '@/features/mainflow/mock-data'

import {
  createEventAuditPageModel,
  createEventDetailPageModel,
} from '../utils/event-detail-adapters'
import type { EventRunSummary } from '../types/event-detail.types'

function toEventRunSummary(run: (typeof runtimeAgentRuns)[number] | null): EventRunSummary | null {
  if (!run) {
    return null
  }

  // 中文注释：事件详情只消费运行摘要最小字段，避免把 mainflow mock 类型变成跨 feature 契约。
  return {
    id: run.id,
    status: run.status,
    providerPolicy: run.providerPolicy,
    duration: run.duration,
    traceId: run.traceId,
    summary: run.summary,
  }
}

export function useEventDetailPage(eventId: string) {
  const event = scoredEvents.find((item) => item.id === eventId) ?? null

  if (!event) {
    return {
      found: false as const,
      model: null,
    }
  }

  const relatedApproval = scoredApprovals.find((item) => item.eventId === event.id) ?? null
  const relatedRun = toEventRunSummary(runtimeAgentRuns.find((item) => item.eventId === event.id) ?? null)

  return {
    found: true as const,
    model: createEventDetailPageModel(event, relatedApproval, relatedRun),
  }
}

export function useEventAuditPage(eventId: string) {
  const event = scoredEvents.find((item) => item.id === eventId) ?? null

  if (!event) {
    return {
      found: false as const,
      model: null,
    }
  }

  const relatedApproval = scoredApprovals.find((item) => item.eventId === event.id) ?? null
  const relatedRun = toEventRunSummary(runtimeAgentRuns.find((item) => item.eventId === event.id) ?? null)

  return {
    found: true as const,
    model: createEventAuditPageModel(event, relatedApproval, relatedRun),
  }
}

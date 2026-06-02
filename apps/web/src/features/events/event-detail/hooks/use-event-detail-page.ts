import {
  scoredApprovals,
  scoredEvents,
} from '@/features/event-scoring/mocks/event-scoring.mock'
import { runtimeAgentRuns } from '@/features/mainflow/mock-data'

import {
  createEventAuditPageModel,
  createEventDetailPageModel,
} from '../utils/event-detail-adapters'

export function useEventDetailPage(eventId: string) {
  const event = scoredEvents.find((item) => item.id === eventId) ?? null

  if (!event) {
    return {
      found: false as const,
      model: null,
    }
  }

  const relatedApproval = scoredApprovals.find((item) => item.eventId === event.id) ?? null
  const relatedRun = runtimeAgentRuns.find((item) => item.eventId === event.id) ?? null

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
  const relatedRun = runtimeAgentRuns.find((item) => item.eventId === event.id) ?? null

  return {
    found: true as const,
    model: createEventAuditPageModel(event, relatedApproval, relatedRun),
  }
}

import {
  scoredEvents,
} from '@/features/event-scoring/mocks/event-scoring.mock'

import { createEventCenterPageModel } from '../utils/event-center-adapters'

export function useEventCenterPage() {
  return createEventCenterPageModel(scoredEvents)
}

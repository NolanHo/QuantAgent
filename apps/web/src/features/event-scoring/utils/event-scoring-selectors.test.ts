import {
  describe,
  expect,
  it,
} from 'vitest'

import { scoredEvents } from '../mocks/event-scoring.mock'
import { selectDashboardHighlightedEvents } from './event-scoring-selectors'

describe('event scoring selectors', () => {
  it('filters out stale, invalid, and policy-blocked events from dashboard highlights', () => {
    const highlighted = selectDashboardHighlightedEvents(scoredEvents)

    expect(highlighted.map((event) => event.id)).toEqual([
      'evt-semiconductor-export',
      'evt-semiconductor-memory',
      'evt-semiconductor-foundry',
    ])
  })
})

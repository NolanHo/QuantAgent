import { describe, expect, it } from 'vitest';

import { defaultEventFilters, toEventQueryParams } from './use-event-filters';

describe('event filters', () => {
  it('defaults to all-time so routed event history is visible on first load', () => {
    expect(toEventQueryParams(defaultEventFilters, Date.UTC(2026, 5, 18, 9, 30, 0))).toEqual({
      keyword: undefined,
      decision: undefined,
      industry_id: undefined,
      sort: 'routed_at_desc',
      time_from: undefined,
      limit: 50,
    });
  });

  it('uses the provided time-window anchor instead of recalculating from render time', () => {
    const filters = {
      ...defaultEventFilters,
      time: 'last-24h' as const,
    };
    const first = toEventQueryParams(filters, Date.UTC(2026, 5, 18, 9, 30, 0));
    const second = toEventQueryParams(filters, Date.UTC(2026, 5, 18, 9, 30, 0));
    const later = toEventQueryParams(filters, Date.UTC(2026, 5, 18, 9, 45, 0));

    expect(first.time_from).toBe('2026-06-17T09:30:00.000Z');
    expect(second).toEqual(first);
    expect(later.time_from).toBe('2026-06-17T09:45:00.000Z');
  });
});

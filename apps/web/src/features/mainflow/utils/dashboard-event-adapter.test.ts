import { describe, expect, it, vi } from 'vitest'

import type { DashboardEventSource } from '../types/dashboard-event.types'
import { toDashboardEventCardModel, toDashboardEventsSummary } from './dashboard-event-adapter'

describe('dashboard-event-adapter', () => {
  it('maps routed backend events into dashboard card models', () => {
    vi.setSystemTime(new Date('2026-06-18T04:00:00.000Z'))

    const card = toDashboardEventCardModel(eventSource({
      priority: 'urgent',
      published_at: '2026-06-18T03:30:00.000Z',
      quality: { confidence: 0.82 },
      relationship_summary: 'semiconductor / direct / 0.74',
      target_industries: ['semiconductor'],
    }))

    expect(card.eventId).toBe('raw-001')
    expect(card.score.priorityBand).toBe('S')
    expect(card.score.eventReliability).toBe(82)
    expect(card.score.freshness).toBe('high')
    expect(card.score.verificationStatus).toBe('dual_verified')
    expect(card.industries).toContain('semiconductor')
  })

  it('keeps review and failed events degraded without inventing analysis success', () => {
    const card = toDashboardEventCardModel(eventSource({
      decision: 'review',
      status: 'failed',
      quality: { confidence: 0.42 },
    }))

    expect(card.status).toBe('analysis_failed')
    expect(card.score.verificationStatus).toBe('invalid_output')
    expect(card.score.recommendationScore).toBe(0)
    expect(card.degradationNotices.map((notice) => notice.kind)).toEqual(['invalid_analysis', 'weak_source', 'weak_source'])
  })

  it('filters discarded events and keeps highest priority first', () => {
    const summary = toDashboardEventsSummary([
      eventSource({ raw_event_id: 'raw-low', priority: 'low', quality: { confidence: 0.55 } }),
      eventSource({ raw_event_id: 'raw-discard', decision: 'discard', priority: 'urgent' }),
      eventSource({ raw_event_id: 'raw-high', priority: 'high', quality: { confidence: 0.8 } }),
    ])

    expect(summary.total).toBe(3)
    expect(summary.items.map((item) => item.eventId)).toEqual(['raw-high', 'raw-low'])
  })
})

function eventSource(overrides: Partial<DashboardEventSource> = {}): DashboardEventSource {
  return {
    raw_event_id: 'raw-001',
    title: '重点事件',
    summary: 'Router Agent 已生成真实事件摘要。',
    source_name: '测试来源',
    source_plugin_id: 'plugin-source-test',
    published_at: '2026-06-18T03:00:00.000Z',
    decision: 'route',
    status: 'success',
    priority: 'normal',
    relationship_summary: null,
    target_industries: [],
    target_topics: [],
    tags: [],
    quality: {},
    trace: {
      analysis_request_id: 'analysis-001',
      binding_id: null,
      correlation_id: 'corr-001',
      raw_event_id: 'raw-001',
      request_id: 'req-001',
      routed_event_id: 'routed-001',
      source_message_id: null,
    },
    timeline: [],
    router_stage_summary: {
      agent_name: 'Router Agent',
      agent_type: 'router_agent',
      has_output_json: true,
      key_fields: {},
      refs: [],
      routed_event_id: 'routed-001',
      stage_id: 'router_agent',
      status: 'success',
      summary: 'Router Agent 已完成处理。',
      unavailable_reason: null,
    },
    ...overrides,
  }
}

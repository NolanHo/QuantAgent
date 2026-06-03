import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  scoredEvents,
} from '@/features/event-scoring/mocks/event-scoring.mock'

import { createEventCenterPageModel } from './event-center-adapters'

describe('event center adapters', () => {
  it('builds featured events from scored mock data', () => {
    const model = createEventCenterPageModel(scoredEvents)

    expect(model.featuredEvents.map((event) => event.id)).toEqual([
      'evt-semiconductor-export',
      'evt-semiconductor-policy-block',
      'evt-semiconductor-memory',
      'evt-semiconductor-foundry',
    ])
  })

  it('keeps list rows sorted by priority and able to enter analysis', () => {
    const model = createEventCenterPageModel(scoredEvents)
    const first = model.listItems[0]!

    expect(first.event.id).toBe('evt-semiconductor-export')
    expect(first.rankLabel).toBe('#01')
    expect(first.scoreSummary).toContain('事件优先级')
    expect(first.analysisState).toBe('可查看分析')
    expect(first.rowReason).toContain('高可信')
  })

  it('keeps mock filters explicit before URL search params are wired', () => {
    const model = createEventCenterPageModel(scoredEvents)

    expect(model.filters.filter((item) => item.active).map((item) => item.label)).toEqual([
      '今日',
      '半导体设备',
    ])
    expect(model.sortOptions.find((item) => item.active)?.label).toBe('最新 + 高价值混合')
  })

  it('maps runtime alerts separately from event ranking', () => {
    const model = createEventCenterPageModel(scoredEvents)

    expect(model.runtimeAlertEvents).toHaveLength(2)
    expect(model.runtimeAlertEvents[0]!.impactDirection).toBe('运行风险提示')
    expect(model.runtimeAlertEvents[0]!.score.selectionReason).toContain('不参与高价值事件打分')
  })
})

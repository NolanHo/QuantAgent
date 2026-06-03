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

    expect(model.filterGroups.map((group) => group.label)).toEqual([
      '时间范围',
      '行业方向',
      '事件价值',
      '分析状态',
    ])
    expect(model.filterGroups.map((group) => group.options.find((item) => item.active)?.label)).toEqual([
      '今日',
      '全部行业',
      '全部价值层级',
      '全部状态',
    ])
    expect(model.sortOptions.find((item) => item.active)?.label).toBe('最新 + 高价值混合')
  })

  it('applies layered mock filters before building visible rows', () => {
    const model = createEventCenterPageModel(scoredEvents, {
      selectedFilterKeys: {
        analysis: 'decision-ready',
        industry: 'semiconductor-equipment',
        time: 'today',
        value: 'high-value',
      },
      selectedSortKey: 'latest',
    })

    expect(model.filterGroups.find((group) => group.key === 'industry')?.options.find((item) => item.active)?.label)
      .toBe('半导体设备')
    expect(model.listItems.map((item) => item.event.id)).toEqual([
      'evt-semiconductor-policy-block',
      'evt-semiconductor-export',
    ])
  })

  it('keeps runtime alerts separate from event ranking', () => {
    const model = createEventCenterPageModel(scoredEvents)

    expect(model.runtimeAlerts).toHaveLength(2)
    expect(model.runtimeAlerts[0]!.title).toContain('source 插件')
  })
})

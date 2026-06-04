import type {
  EventScoreCardModel,
} from '@/features/event-scoring/types/event-scoring.types'

import type {
  EventCenterFilterSelection,
} from '../types/event-center.types'

const filterGroups = [
  {
    key: 'time',
    label: '时间范围',
    options: [
      { label: '今日', value: 'today', active: true },
      { label: '近 3 小时', value: 'last-3h', active: false },
      { label: '全部时间', value: 'all-time', active: false },
    ],
  },
  {
    key: 'industry',
    label: '行业方向',
    options: [
      { label: '全部行业', value: 'all-industries', active: true },
      { label: '半导体设备', value: 'semiconductor-equipment', active: false },
      { label: '存储芯片', value: 'memory', active: false },
      { label: '晶圆代工', value: 'foundry', active: false },
    ],
  },
  {
    key: 'value',
    label: '事件价值',
    options: [
      { label: '全部价值层级', value: 'all-value', active: true },
      { label: '高价值优先', value: 'high-value', active: false },
      { label: '可信度 >= 55', value: 'reliability-55', active: false },
    ],
  },
  {
    key: 'analysis',
    label: '分析状态',
    options: [
      { label: '全部状态', value: 'all-status', active: true },
      { label: '可查看分析', value: 'decision-ready', active: false },
      { label: '分析中', value: 'analyzing', active: false },
      { label: '待复核 / 失败', value: 'review-required', active: false },
    ],
  },
] as const

const sortOptions = [
  { label: '最新 + 高价值混合', value: 'hybrid', active: true },
  { label: '最新优先', value: 'latest', active: false },
  { label: '高价值优先', value: 'high-value', active: false },
] as const

export const eventCenterDefaultFilterSelection: EventCenterFilterSelection = Object.fromEntries(
  filterGroups.map((group) => {
    const activeOption = group.options.find((option) => option.active) ?? group.options[0]

    return [group.key, activeOption.value]
  }),
)

export const eventCenterDefaultSortKey: string = sortOptions.find((option) => option.active)?.value ?? sortOptions[0]!.value

export function buildEventCenterFilterGroups(selectedFilterKeys: EventCenterFilterSelection) {
  return filterGroups.map((group) => ({
    ...group,
    options: group.options.map((option) => ({
      ...option,
      active: option.value === selectedFilterKeys[group.key],
    })),
  }))
}

export function buildEventCenterSortOptions(selectedSortKey: string) {
  return sortOptions.map((option) => ({
    ...option,
    active: option.value === selectedSortKey,
  }))
}

function matchesTimeFilter(event: EventScoreCardModel, selectedKey: string) {
  if (selectedKey === 'last-3h') {
    return event.publishedMinutesAgo <= 180
  }

  if (selectedKey === 'all-time') {
    return true
  }

  return event.publishedMinutesAgo <= 24 * 60
}

function matchesIndustryFilter(event: EventScoreCardModel, selectedKey: string) {
  const industryByKey: Record<string, string> = {
    'semiconductor-equipment': '半导体设备',
    memory: '存储芯片',
    foundry: '晶圆代工',
  }
  const expectedIndustry = industryByKey[selectedKey]

  return expectedIndustry ? event.industries.includes(expectedIndustry) : true
}

function matchesValueFilter(event: EventScoreCardModel, selectedKey: string) {
  if (selectedKey === 'high-value') {
    return event.score.priorityBand === 'S' || event.score.priorityBand === 'A' || event.score.eventPriority >= 70
  }

  if (selectedKey === 'reliability-55') {
    return event.score.eventReliability >= 55
  }

  return true
}

function matchesAnalysisFilter(event: EventScoreCardModel, selectedKey: string) {
  if (selectedKey === 'decision-ready') {
    return event.status === 'decision_ready' || event.status === 'pending_approval' || event.status === 'policy_blocked'
  }

  if (selectedKey === 'analyzing') {
    return event.status === 'analyzing'
  }

  if (selectedKey === 'review-required') {
    return event.status === 'analysis_failed' || event.status === 'policy_blocked' || event.status === 'pending_approval'
  }

  return true
}

export function filterEventCenterEvents(
  events: readonly EventScoreCardModel[],
  selectedFilterKeys: EventCenterFilterSelection,
) {
  return events.filter((event) => (
    matchesTimeFilter(event, selectedFilterKeys.time ?? 'today')
    && matchesIndustryFilter(event, selectedFilterKeys.industry ?? 'all-industries')
    && matchesValueFilter(event, selectedFilterKeys.value ?? 'all-value')
    && matchesAnalysisFilter(event, selectedFilterKeys.analysis ?? 'all-status')
  ))
}

export function sortEventCenterEvents(
  events: readonly EventScoreCardModel[],
  selectedSortKey: string,
) {
  return [...events].sort((left, right) => {
    if (selectedSortKey === 'latest') {
      return left.publishedMinutesAgo - right.publishedMinutesAgo
    }

    if (selectedSortKey === 'high-value') {
      const priorityDelta = right.score.eventPriority - left.score.eventPriority

      if (priorityDelta !== 0) {
        return priorityDelta
      }

      return right.score.eventReliability - left.score.eventReliability
    }

    const priorityDelta = right.score.eventPriority - left.score.eventPriority

    if (priorityDelta !== 0) {
      return priorityDelta
    }

    return left.publishedMinutesAgo - right.publishedMinutesAgo
  })
}

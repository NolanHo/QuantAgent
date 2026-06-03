import {
  healthAlerts,
} from '@/features/mainflow/mock-data'
import {
  createHealthAlertEventCardModel,
} from '@/features/event-scoring/utils/event-scoring-adapters'
import {
  formatEventReliability,
  formatImpactStrength,
  formatPriorityLabel,
  formatVerificationStatus,
} from '@/features/event-scoring/utils/event-scoring-labels'
import type {
  AnalysisStatus,
  EventScoreCardModel,
} from '@/features/event-scoring/types/event-scoring.types'

import type {
  EventCenterListItem,
  EventCenterModelOptions,
  EventCenterPageModel,
} from '../types/event-center.types'
import {
  buildEventCenterFilterGroups,
  buildEventCenterSortOptions,
  eventCenterDefaultFilterSelection,
  eventCenterDefaultSortKey,
  filterEventCenterEvents,
  sortEventCenterEvents,
} from './event-center-filters'

const analysisStateCopies: Record<AnalysisStatus, string> = {
  captured: '已捕获，等待分析',
  analyzing: '分析中',
  decision_ready: '可查看分析',
  pending_approval: '已进入审批',
  warning: '运行提醒',
  analysis_failed: '分析失败',
  policy_blocked: 'Policy Gate 阻断',
}

function buildStatusBuckets(events: readonly EventScoreCardModel[]) {
  return events.reduce<Record<AnalysisStatus, number>>((acc, event) => {
    acc[event.status] += 1
    return acc
  }, {
    captured: 0,
    analyzing: 0,
    decision_ready: 0,
    pending_approval: 0,
    warning: 0,
    analysis_failed: 0,
    policy_blocked: 0,
  })
}

function isFeaturedEvent(event: EventScoreCardModel) {
  return event.score.priorityBand === 'S'
    || event.score.eventPriority >= 70
    || event.status === 'pending_approval'
    || event.status === 'policy_blocked'
}

function buildListItem(event: EventScoreCardModel, index: number): EventCenterListItem {
  return {
    event,
    rankLabel: `#${String(index + 1).padStart(2, '0')}`,
    scoreSummary: [
      formatPriorityLabel(event.score.eventPriority, event.score.priorityBand),
      formatEventReliability(event.score.eventReliability),
      formatImpactStrength(event.score.impactStrength),
      formatVerificationStatus(event.score.verificationStatus),
    ].join(' · '),
    analysisState: analysisStateCopies[event.status],
    rowReason: event.score.selectionReason,
  }
}

export function createEventCenterPageModel(
  events: readonly EventScoreCardModel[],
  options: EventCenterModelOptions = {},
): EventCenterPageModel {
  const selectedFilterKeys = {
    ...eventCenterDefaultFilterSelection,
    ...options.selectedFilterKeys,
  }
  const selectedSortKey = options.selectedSortKey ?? eventCenterDefaultSortKey
  const filteredEvents = filterEventCenterEvents(events, selectedFilterKeys)
  const sortedEvents = sortEventCenterEvents(filteredEvents, selectedSortKey)
  const statusBuckets = buildStatusBuckets(events)
  const featuredEvents = sortedEvents.filter(isFeaturedEvent).slice(0, 4)
  const runtimeAlertEvents = events.length > 0
    ? healthAlerts.map((alert, index) => createHealthAlertEventCardModel(alert, events[index] ?? events[0]!))
    : []

  // 中文注释：事件中心只做浏览和筛选入口，不能把高分或高优先级表达成审批/执行动作。
  return {
    featuredEvents,
    listItems: sortedEvents.map(buildListItem),
    filterGroups: buildEventCenterFilterGroups(selectedFilterKeys),
    sortOptions: buildEventCenterSortOptions(selectedSortKey),
    statusBuckets,
    runtimeAlertEvents,
  }
}

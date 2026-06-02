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
  EventCenterPageModel,
} from '../types/event-center.types'

const analysisStateCopies: Record<AnalysisStatus, string> = {
  captured: '已捕获，等待分析',
  analyzing: '分析中',
  decision_ready: '可查看分析',
  pending_approval: '已进入审批',
  warning: '运行提醒',
  analysis_failed: '分析失败',
  policy_blocked: 'Policy Gate 阻断',
}

const filterLabels = [
  '今日',
  '半导体设备',
  '存储芯片',
  '晶圆代工',
  '事件可信度 >= 55',
  '可查看分析',
  '待复核 / 失败',
] as const

const sortLabels = [
  '最新 + 高价值混合',
  '最新优先',
  '高价值优先',
] as const

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
): EventCenterPageModel {
  const sortedEvents = [...events].sort((left, right) => {
    const priorityDelta = right.score.eventPriority - left.score.eventPriority

    if (priorityDelta !== 0) {
      return priorityDelta
    }

    return left.publishedMinutesAgo - right.publishedMinutesAgo
  })
  const statusBuckets = buildStatusBuckets(events)
  const featuredEvents = sortedEvents.filter(isFeaturedEvent).slice(0, 4)
  const runtimeAlertEvents = events.length > 0
    ? healthAlerts.map((alert, index) => createHealthAlertEventCardModel(alert, events[index] ?? events[0]!))
    : []

  // 中文注释：事件中心只做浏览和筛选入口，不能把高分或高优先级表达成审批/执行动作。
  return {
    metrics: [
      {
        label: '新事件',
        value: String(events.filter((event) => event.publishedMinutesAgo <= 180).length).padStart(2, '0'),
        description: '近 3 小时进入事件池',
      },
      {
        label: '重点事件',
        value: String(featuredEvents.length).padStart(2, '0'),
        description: 'S/A 优先级或已进入审批链路',
      },
      {
        label: '分析中',
        value: String(statusBuckets.analyzing).padStart(2, '0'),
        description: '事实可见，分析结果待完成',
      },
      {
        label: '待复核',
        value: String(statusBuckets.analysis_failed + statusBuckets.policy_blocked + statusBuckets.pending_approval).padStart(2, '0'),
        description: '失败、阻断或需要人工确认',
      },
    ],
    featuredEvents,
    listItems: sortedEvents.map(buildListItem),
    filters: filterLabels.map((label, index) => ({
      label,
      value: label,
      active: index <= 1,
    })),
    sortOptions: sortLabels.map((label, index) => ({
      label,
      value: label,
      active: index === 0,
    })),
    statusBuckets,
    runtimeAlertEvents,
  }
}

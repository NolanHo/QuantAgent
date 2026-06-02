import type {
  AnalysisStatus,
  EventScoreCardModel,
} from '@/features/event-scoring/types/event-scoring.types'

export interface EventCenterMetric {
  label: string
  value: string
  description: string
}

export interface EventCenterFilterOption {
  label: string
  value: string
  active: boolean
}

export interface EventCenterListItem {
  event: EventScoreCardModel
  rankLabel: string
  scoreSummary: string
  analysisState: string
  rowReason: string
}

export interface EventCenterPageModel {
  metrics: readonly EventCenterMetric[]
  featuredEvents: readonly EventScoreCardModel[]
  listItems: readonly EventCenterListItem[]
  filters: readonly EventCenterFilterOption[]
  sortOptions: readonly EventCenterFilterOption[]
  statusBuckets: Readonly<Record<AnalysisStatus, number>>
  runtimeAlertEvents: readonly EventScoreCardModel[]
}

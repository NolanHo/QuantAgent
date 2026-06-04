import type {
  AnalysisStatus,
  EventScoreCardModel,
} from '@/features/event-scoring/types/event-scoring.types'

export interface EventCenterFilterOption {
  label: string
  value: string
  active: boolean
}

export interface EventCenterFilterGroup {
  key: string
  label: string
  options: readonly EventCenterFilterOption[]
}

export type EventCenterFilterSelection = Readonly<Record<string, string>>

export interface EventCenterModelOptions {
  selectedFilterKeys?: EventCenterFilterSelection
  selectedSortKey?: string
}

export interface EventCenterListItem {
  event: EventScoreCardModel
  rankLabel: string
  verificationLabel: string
  analysisState: string
}

export interface EventCenterPageModel {
  listItems: readonly EventCenterListItem[]
  filterGroups: readonly EventCenterFilterGroup[]
  sortOptions: readonly EventCenterFilterOption[]
  statusBuckets: Readonly<Record<AnalysisStatus, number>>
}

import {
  useState,
} from 'react'

import {
  scoredEvents,
} from '@/features/event-scoring/mocks/event-scoring.mock'

import {
  createEventCenterPageModel,
} from '../utils/event-center-adapters'
import {
  eventCenterDefaultFilterSelection,
  eventCenterDefaultSortKey,
} from '../utils/event-center-filters'

export function useEventCenterPage() {
  const [selectedFilterKeys, setSelectedFilterKeys] = useState(eventCenterDefaultFilterSelection)
  const [selectedSortKey, setSelectedSortKey] = useState(eventCenterDefaultSortKey)
  const model = createEventCenterPageModel(scoredEvents, {
    selectedFilterKeys,
    selectedSortKey,
  })

  function selectFilter(groupKey: string, value: string) {
    setSelectedFilterKeys((current) => ({
      ...current,
      [groupKey]: value,
    }))
  }

  return {
    model,
    selectFilter,
    selectSort: setSelectedSortKey,
  }
}

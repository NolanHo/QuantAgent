import { useMemo, useState } from 'react'

import { getApprovalWorkbenchItem } from '../mock/approval-workbench.mock'
import { useApprovalWorkbenchActions } from './use-approval-workbench-actions'
import { useApprovalWorkbenchListQuery } from '../queries/use-approval-workbench-list'
import { useApprovalWorkbenchOverviewQuery } from '../queries/use-approval-workbench-overview'
import type {
  ApprovalSortMode,
  ApprovalWorkbenchSearch,
} from '../types/approval-workbench.types'
import { computeBatchEligibility } from '../utils/approval-rules'

export function normalizeApprovalWorkbenchSearch(
  search: Record<string, unknown>,
): ApprovalWorkbenchSearch {
  return {
    confirmation:
      typeof search.confirmation === 'string' ? (search.confirmation as ApprovalWorkbenchSearch['confirmation']) : 'all',
    riskDirection:
      typeof search.riskDirection === 'string' ? (search.riskDirection as ApprovalWorkbenchSearch['riskDirection']) : 'all',
    sort: typeof search.sort === 'string' ? (search.sort as ApprovalSortMode) : 'recommendation',
    status: typeof search.status === 'string' ? (search.status as ApprovalWorkbenchSearch['status']) : 'pending',
  }
}

export function useApprovalWorkbenchPage(search: ApprovalWorkbenchSearch) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const listQuery = useApprovalWorkbenchListQuery(search)
  const overviewQuery = useApprovalWorkbenchOverviewQuery()
  const items = listQuery.data ?? []
  const overview = overviewQuery.data ?? {
    pendingCount: 0,
    expiringSoonCount: 0,
    highRiskCount: 0,
    strongConfirmationCount: 0,
  }
  const batchEligibility = useMemo(
    () => computeBatchEligibility(items, selectedIds),
    [items, selectedIds],
  )

  function toggleSelection(approvalId: string) {
    setSelectedIds((current) =>
      current.includes(approvalId)
        ? current.filter((candidate) => candidate !== approvalId)
        : [...current, approvalId],
    )
  }

  function clearSelectionForAppliedIds(appliedIds: readonly string[]) {
    setSelectedIds((current) => current.filter((candidate) => !appliedIds.includes(candidate)))
  }

  const actions = useApprovalWorkbenchActions({
    onAfterSuccess: clearSelectionForAppliedIds,
    search,
  })

  function getApprovalById(approvalId: string) {
    return getApprovalWorkbenchItem(approvalId)
  }

  return {
    actions,
    batchEligibility,
    getApprovalById,
    items,
    listQuery,
    overview,
    overviewQuery,
    selectedIds,
    toggleSelection,
  }
}

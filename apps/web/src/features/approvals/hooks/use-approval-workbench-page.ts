import { useMemo, useState } from 'react'

import { useApprovalWorkbenchActions } from './use-approval-workbench-actions'
import { useApprovalWorkbenchListQuery } from '../queries/use-approval-workbench-list'
import { useApprovalWorkbenchOverviewQuery } from '../queries/use-approval-workbench-overview'
import type {
  ApprovalConfirmationLevel,
  ApprovalRiskDirection,
  ApprovalSortMode,
  ApprovalStatus,
  ApprovalWorkbenchSearch,
} from '../types/approval-workbench.types'
import { computeBatchEligibility } from '../utils/approval-rules'

const confirmationValues: Array<ApprovalConfirmationLevel | 'all'> = [
  'all',
  'strong_confirm',
  'link_confirm',
  'manual_only',
]
const riskDirectionValues: Array<ApprovalRiskDirection | 'all'> = [
  'all',
  'increase_risk',
  'reduce_risk',
  'neutral',
]
const sortValues: ApprovalSortMode[] = [
  'recommendation',
  'expires_soon',
  'highest_risk',
  'latest',
]
const statusValues: Array<ApprovalStatus | 'all'> = [
  'all',
  'pending',
  'approved',
  'rejected',
  'expired',
  'reanalysis_requested',
]

function pickAllowedValue<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  fallback: T,
): T {
  return typeof value === 'string' && allowedValues.includes(value as T) ? (value as T) : fallback
}

export function normalizeApprovalWorkbenchSearch(
  search: Record<string, unknown>,
): ApprovalWorkbenchSearch {
  // 中文注释：URL search 是外部输入，必须先白名单化，避免无效字符串进入筛选和排序规则。
  return {
    confirmation: pickAllowedValue(search.confirmation, confirmationValues, 'all'),
    riskDirection: pickAllowedValue(search.riskDirection, riskDirectionValues, 'all'),
    sort: pickAllowedValue(search.sort, sortValues, 'recommendation'),
    status: pickAllowedValue(search.status, statusValues, 'pending'),
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
  })

  return {
    actions,
    batchEligibility,
    items,
    listQuery,
    overview,
    overviewQuery,
    selectedIds,
    toggleSelection,
  }
}

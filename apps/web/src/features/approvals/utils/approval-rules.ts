import type {
  ApprovalBatchEligibility,
  ApprovalSortMode,
  ApprovalWorkbenchItem,
  ApprovalWorkbenchOverview,
  ApprovalWorkbenchSearch,
} from '../types/approval-workbench.types'

export function createApprovalWorkbenchOverview(items: readonly ApprovalWorkbenchItem[]): ApprovalWorkbenchOverview {
  return {
    pendingCount: items.filter((item) => item.status === 'pending').length,
    expiringSoonCount: items.filter((item) => item.status === 'pending' && item.expiresSoon).length,
    highRiskCount: items.filter((item) => item.status === 'pending' && item.riskLevel === '高').length,
    strongConfirmationCount: items.filter(
      (item) => item.status === 'pending' && item.confirmationLevel === 'strong_confirm',
    ).length,
  }
}

export function filterApprovalWorkbenchItems(
  items: readonly ApprovalWorkbenchItem[],
  search: ApprovalWorkbenchSearch,
) {
  return items.filter((item) => {
    if (search.status && search.status !== 'all' && item.status !== search.status) {
      return false
    }
    if (
      search.riskDirection &&
      search.riskDirection !== 'all' &&
      item.riskDirection !== search.riskDirection
    ) {
      return false
    }
    if (
      search.confirmation &&
      search.confirmation !== 'all' &&
      item.confirmationLevel !== search.confirmation
    ) {
      return false
    }
    return true
  })
}

export function sortApprovalWorkbenchItems(
  items: readonly ApprovalWorkbenchItem[],
  sortMode: ApprovalSortMode,
) {
  const sorted = [...items]
  sorted.sort((left, right) => {
    if (sortMode === 'expires_soon') {
      if (Number(right.expiresSoon) !== Number(left.expiresSoon)) {
        return Number(right.expiresSoon) - Number(left.expiresSoon)
      }
      return right.recommendationScore - left.recommendationScore
    }

    if (sortMode === 'highest_risk') {
      if (right.riskScore !== left.riskScore) {
        return right.riskScore - left.riskScore
      }
      return right.recommendationScore - left.recommendationScore
    }

    if (sortMode === 'latest') {
      if (right.createdOrder !== left.createdOrder) {
        return right.createdOrder - left.createdOrder
      }
      return right.recommendationScore - left.recommendationScore
    }

    if (right.recommendationScore !== left.recommendationScore) {
      return right.recommendationScore - left.recommendationScore
    }
    if (Number(right.expiresSoon) !== Number(left.expiresSoon)) {
      return Number(right.expiresSoon) - Number(left.expiresSoon)
    }
    if (right.riskScore !== left.riskScore) {
      return right.riskScore - left.riskScore
    }
    return right.createdOrder - left.createdOrder
  })
  return sorted
}

export function computeBatchEligibility(
  items: readonly ApprovalWorkbenchItem[],
  selectedIds: readonly string[],
): ApprovalBatchEligibility {
  const selectedItems = items.filter((item) => selectedIds.includes(item.id))
  if (selectedItems.length === 0) {
    return { eligibleIds: [], issues: [] }
  }

  const baselineItem = selectedItems.find(
    (item) => item.status === 'pending' && item.confirmationLevel !== 'manual_only' && !item.expiresSoon,
  )
  // 中文注释：基准项由 selectedItems 顺序决定；若要按用户指定基准，必须显式传入或调整选择排序。
  const eligibleIds: string[] = []
  const issues: ApprovalBatchEligibility['issues'] = []

  if (!baselineItem) {
    return {
      eligibleIds: [],
      issues: selectedItems.map((item) => ({
        approvalId: item.id,
        reason: item.batchBlockReason ?? '当前选择中没有可用于批量处理的基准审批',
      })),
    }
  }

  for (const item of selectedItems) {
    if (item.status !== 'pending') {
      issues.push({ approvalId: item.id, reason: '当前审批已不处于待处理状态' })
      continue
    }
    if (item.confirmationLevel === 'manual_only') {
      issues.push({ approvalId: item.id, reason: 'manual_only 只能逐条处理' })
      continue
    }
    if (item.expiresSoon) {
      issues.push({ approvalId: item.id, reason: '即将自动过期的审批不能进入首版批量处理' })
      continue
    }
    if (item.riskDirection !== baselineItem.riskDirection) {
      issues.push({ approvalId: item.id, reason: '批量处理要求风险方向一致' })
      continue
    }
    if (item.confirmationLevel !== baselineItem.confirmationLevel) {
      issues.push({ approvalId: item.id, reason: '批量处理要求确认等级一致' })
      continue
    }
    eligibleIds.push(item.id)
  }

  return { eligibleIds, issues }
}

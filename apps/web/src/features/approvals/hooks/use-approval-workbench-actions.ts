import { useMemo, useState } from 'react'
import { useOverlayState } from '@heroui/react'

import { useApprovalWorkbenchActionMutation } from '../mutations/use-approval-workbench-action'
import type {
  ApprovalActionType,
  ApprovalWorkbenchItem,
} from '../types/approval-workbench.types'

export function useApprovalWorkbenchActions({
  onAfterSuccess,
}: {
  onAfterSuccess: (appliedIds: readonly string[]) => void
}) {
  const actionState = useOverlayState()
  const actionMutation = useApprovalWorkbenchActionMutation()
  const [activeAction, setActiveAction] = useState<{
    action: ApprovalActionType
    items: ApprovalWorkbenchItem[]
  } | null>(null)

  const actionTitle = useMemo(() => {
    if (!activeAction) return '审批动作'
    if (activeAction.action === 'approve') return '确认人工批准'
    if (activeAction.action === 'reject') return '确认人工拒绝'
    return '确认请求重分析'
  }, [activeAction])

  function openSingleAction(action: ApprovalActionType, approval: ApprovalWorkbenchItem) {
    setActiveAction({ action, items: [approval] })
    actionState.open()
  }

  async function confirmActiveAction(reason?: string) {
    if (!activeAction) return
    const result = await actionMutation.mutateAsync({
      action: activeAction.action,
      approvalIds: activeAction.items.map((item) => item.id),
      reason,
    })
    onAfterSuccess(result.appliedIds)
    actionState.close()
  }

  return {
    actionMutation,
    actionState,
    actionTitle,
    activeAction,
    confirmActiveAction,
    openSingleAction,
  }
}

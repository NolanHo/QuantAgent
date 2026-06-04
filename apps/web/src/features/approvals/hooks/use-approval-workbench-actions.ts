import { useMemo, useState } from 'react'
import { useOverlayState } from '@heroui/react'

import { toApiError } from '../../../shared/api/errors'
import { useApprovalWorkbenchActionMutation } from '../mutations/use-approval-workbench-action'
import type {
  ApprovalActionFeedback,
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
  const [actionFeedback, setActionFeedback] = useState<ApprovalActionFeedback | null>(null)
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
    setActionFeedback(null)
    setActiveAction({ action, items: [approval] })
    actionState.open()
  }

  async function confirmActiveAction(reason?: string) {
    if (!activeAction) return
    setActionFeedback(null)

    try {
      const result = await actionMutation.mutateAsync({
        action: activeAction.action,
        approvalIds: activeAction.items.map((item) => item.id),
        reason,
      })

      if (result.appliedIds.length > 0) {
        onAfterSuccess(result.appliedIds)
      }

      if (result.failedIds.length > 0) {
        const firstFailure = result.failures[0]
        setActionFeedback({
          message: firstFailure?.message ?? 'approval_action_failed',
          requestId: firstFailure?.requestId ?? `req-${activeAction.action}-partial-failed`,
          traceId: firstFailure?.traceId ?? `trace-${activeAction.action}-partial-failed`,
        })
        return
      }

      actionState.close()
    } catch (error) {
      const apiError = toApiError(error)
      setActionFeedback({
        message: 'approval_action_failed',
        requestId: apiError.requestId ?? 'req-approval-mutation',
        traceId: apiError.traceId ?? 'trace-approval-mutation',
      })
    }
  }

  return {
    actionMutation,
    actionFeedback,
    actionState,
    actionTitle,
    activeAction,
    confirmActiveAction,
    openSingleAction,
  }
}

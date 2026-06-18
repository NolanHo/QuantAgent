import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useApis } from '@/app/runtime'
import { mapApprovalActionResponse } from '../api/approval-workbench.contracts'
import type {
  ApprovalActionResult,
  ApprovalActionType,
} from '../types/approval-workbench.types'
import { approvalWorkbenchKeys } from '../queries/approval-workbench.keys'

export function invalidateApprovalWorkbenchActionQueries(
  queryClient: Pick<ReturnType<typeof useQueryClient>, 'invalidateQueries'>,
  approvalIds: string[],
) {
  void queryClient.invalidateQueries({ queryKey: approvalWorkbenchKeys.overview() })
  void queryClient.invalidateQueries({ queryKey: approvalWorkbenchKeys.lists() })
  for (const approvalId of approvalIds) {
    void queryClient.invalidateQueries({ queryKey: approvalWorkbenchKeys.detail(approvalId) })
  }
}

export function useApprovalWorkbenchActionMutation() {
  const { approvalWorkbench } = useApis()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      action,
      approvalIds,
      reason,
    }: {
      action: ApprovalActionType
      approvalIds: string[]
      reason?: string
    }): Promise<ApprovalActionResult> => {
      const responses = await Promise.all(
        approvalIds.map((approvalId) => approvalWorkbench.submitAction({ action, approvalId, reason })),
      )
      return mapApprovalActionResponse(action, approvalIds, responses)
    },
    onSuccess: (_result, variables) => {
      invalidateApprovalWorkbenchActionQueries(queryClient, variables.approvalIds)
    },
  })
}

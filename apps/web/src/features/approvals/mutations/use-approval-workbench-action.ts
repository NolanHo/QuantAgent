import { useMutation, useQueryClient } from '@tanstack/react-query'

import { runApprovalAction } from '../mock/approval-workbench.mock'
import type {
  ApprovalActionResult,
  ApprovalActionType,
} from '../types/approval-workbench.types'
import { approvalWorkbenchKeys } from '../queries/approval-workbench.keys'

export function useApprovalWorkbenchActionMutation() {
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
    }): Promise<ApprovalActionResult> => runApprovalAction({ action, approvalIds, reason }),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: approvalWorkbenchKeys.overview() })
      void queryClient.invalidateQueries({ queryKey: approvalWorkbenchKeys.lists() })
      for (const approvalId of variables.approvalIds) {
        void queryClient.invalidateQueries({ queryKey: approvalWorkbenchKeys.detail(approvalId) })
      }
    },
  })
}

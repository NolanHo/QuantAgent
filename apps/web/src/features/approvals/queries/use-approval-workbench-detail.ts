import { useQuery } from '@tanstack/react-query'

import { getApprovalWorkbenchItem } from '../mock/approval-workbench.mock'
import { approvalWorkbenchKeys } from './approval-workbench.keys'

export function useApprovalWorkbenchDetailQuery(approvalId: string) {
  return useQuery({
    queryFn: () => getApprovalWorkbenchItem(approvalId),
    queryKey: approvalWorkbenchKeys.detail(approvalId),
  })
}

import { useQuery } from '@tanstack/react-query'

import { useApis } from '@/app/runtime'
import { mapApprovalDetail } from '../api/approval-workbench.contracts'
import { approvalWorkbenchKeys } from './approval-workbench.keys'

export function useApprovalWorkbenchDetailQuery(approvalId: string) {
  const { approvalWorkbench } = useApis()

  return useQuery({
    queryFn: async () => mapApprovalDetail(await approvalWorkbench.getApproval(approvalId)),
    queryKey: approvalWorkbenchKeys.detail(approvalId),
  })
}

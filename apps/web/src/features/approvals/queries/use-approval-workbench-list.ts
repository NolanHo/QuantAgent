import { useQuery } from '@tanstack/react-query'

import { useApis } from '@/app/runtime'
import type { ApprovalWorkbenchSearch } from '../types/approval-workbench.types'
import { mapApprovalListResponse, toApprovalWorkbenchListParams } from '../api/approval-workbench.contracts'
import { approvalWorkbenchKeys } from './approval-workbench.keys'

export function useApprovalWorkbenchListQuery(search: ApprovalWorkbenchSearch) {
  const { approvalWorkbench } = useApis()

  return useQuery({
    queryFn: async () => mapApprovalListResponse(await approvalWorkbench.listApprovals(toApprovalWorkbenchListParams(search)), search),
    queryKey: approvalWorkbenchKeys.list(search),
  })
}

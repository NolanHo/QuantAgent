import { useQuery } from '@tanstack/react-query'

import { useApis } from '@/app/runtime'
import { mapApprovalOverview } from '../api/approval-workbench.contracts'
import { approvalWorkbenchKeys } from './approval-workbench.keys'

export function useApprovalWorkbenchOverviewQuery() {
  const { approvalWorkbench } = useApis()

  return useQuery({
    queryFn: async () => mapApprovalOverview(await approvalWorkbench.listApprovals({ limit: 100 })),
    queryKey: approvalWorkbenchKeys.overview(),
  })
}

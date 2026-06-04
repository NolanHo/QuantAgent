import { useQuery } from '@tanstack/react-query'

import { listApprovalWorkbenchItems } from '../mock/approval-workbench.mock'
import { createApprovalWorkbenchOverview } from '../utils/approval-rules'
import { approvalWorkbenchKeys } from './approval-workbench.keys'

export function useApprovalWorkbenchOverviewQuery() {
  return useQuery({
    queryFn: () => createApprovalWorkbenchOverview(listApprovalWorkbenchItems()),
    queryKey: approvalWorkbenchKeys.overview(),
  })
}

import { useQuery } from '@tanstack/react-query'

import { getApprovalLinkContext } from '../mock/approval-workbench.mock'
import { approvalWorkbenchKeys } from './approval-workbench.keys'

export function useApprovalLinkContextQuery(token: string) {
  return useQuery({
    queryFn: () => getApprovalLinkContext(token),
    queryKey: approvalWorkbenchKeys.linkContext(token),
  })
}

import { useQuery } from '@tanstack/react-query'

import { listApprovalWorkbenchItems } from '../mock/approval-workbench.mock'
import type { ApprovalWorkbenchSearch } from '../types/approval-workbench.types'
import { filterApprovalWorkbenchItems, sortApprovalWorkbenchItems } from '../utils/approval-rules'
import { approvalWorkbenchKeys } from './approval-workbench.keys'

export function useApprovalWorkbenchListQuery(search: ApprovalWorkbenchSearch) {
  return useQuery({
    queryFn: () => {
      const items = listApprovalWorkbenchItems()
      return sortApprovalWorkbenchItems(
        filterApprovalWorkbenchItems(items, search),
        search.sort ?? 'recommendation',
      )
    },
    queryKey: approvalWorkbenchKeys.list(search),
  })
}

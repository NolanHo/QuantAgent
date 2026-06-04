import type { ApprovalWorkbenchSearch } from '../types/approval-workbench.types'

export const approvalWorkbenchKeys = {
  all: ['approval-workbench'] as const,
  detail: (approvalId: string) => [...approvalWorkbenchKeys.all, 'detail', approvalId] as const,
  linkContext: (token: string) => [...approvalWorkbenchKeys.all, 'link-context', token] as const,
  lists: () => [...approvalWorkbenchKeys.all, 'list'] as const,
  list: (search: ApprovalWorkbenchSearch) => [...approvalWorkbenchKeys.lists(), search] as const,
  overview: () => [...approvalWorkbenchKeys.all, 'overview'] as const,
}

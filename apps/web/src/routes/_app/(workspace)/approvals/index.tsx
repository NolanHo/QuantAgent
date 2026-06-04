import { createFileRoute, useNavigate } from '@tanstack/react-router'

import {
  ApprovalWorkbenchPage,
  normalizeApprovalWorkbenchSearch,
} from '../../../../features/approvals'
import type { ApprovalWorkbenchSearch } from '../../../../features/approvals/types/approval-workbench.types'

export const Route = createFileRoute('/_app/(workspace)/approvals/')({
  validateSearch: normalizeApprovalWorkbenchSearch,
  component: ApprovalsPage,
})

function ApprovalsPage() {
  const navigate = useNavigate({ from: Route.fullPath })
  const search = Route.useSearch()

  function handleUpdateSearch(patch: Partial<typeof search>) {
    void navigate({
      search: (current: ApprovalWorkbenchSearch) => ({
        ...current,
        ...patch,
      }),
    })
  }

  return <ApprovalWorkbenchPage onUpdateSearch={handleUpdateSearch} search={search} />
}

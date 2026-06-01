import { createFileRoute } from '@tanstack/react-router'

import { ApprovalDetailPage } from '../../../../features/approvals'

export const Route = createFileRoute('/_app/(workspace)/approvals/$approvalId')({
  component: ApprovalDetailRoute,
})

function ApprovalDetailRoute() {
  const { approvalId } = Route.useParams()

  return <ApprovalDetailPage approvalId={approvalId} />
}

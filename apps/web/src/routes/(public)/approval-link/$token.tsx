import { createFileRoute } from '@tanstack/react-router'

import { ApprovalLinkPage } from '../../../features/approvals'

export const Route = createFileRoute('/(public)/approval-link/$token')({
  component: ApprovalLinkRoute,
})

function ApprovalLinkRoute() {
  const { token } = Route.useParams()

  return <ApprovalLinkPage token={token} />
}

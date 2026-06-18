import { useEventListQuery } from '@/features/events/queries'
import { useQuery } from '@tanstack/react-query'
import { useApis } from '@/app/runtime'

import { toDashboardEventsSummary } from '../utils/dashboard-event-adapter'
import { createDashboardOverview } from '../utils/dashboard-overview-adapter'

const dashboardKeys = {
  approvals: ['dashboard', 'approvals'] as const,
  runtimeErrors: ['dashboard', 'runtime-errors'] as const,
  runtimeHealth: ['dashboard', 'runtime-health'] as const,
}

export function useDashboardEvents() {
  const { approvalWorkbench, runtimeInspect } = useApis()
  const eventsQuery = useEventListQuery({
    limit: 5,
    sort: 'routed_at_desc',
  })
  const approvalsQuery = useQuery({
    queryFn: () => approvalWorkbench.listApprovals({ limit: 50, status: 'pending' }),
    queryKey: dashboardKeys.approvals,
  })
  const runtimeHealthQuery = useQuery({
    queryFn: () => runtimeInspect.getRuntimeHealth(),
    queryKey: dashboardKeys.runtimeHealth,
  })
  const runtimeErrorsQuery = useQuery({
    queryFn: () => runtimeInspect.listRuntimeErrors({ page_size: 3 }),
    queryKey: dashboardKeys.runtimeErrors,
  })
  const highlightedEvents = toDashboardEventsSummary(eventsQuery.data?.items ?? [])

  return {
    approvalsQuery,
    eventsQuery,
    highlightedEvents,
    overview: createDashboardOverview({
      approvals: approvalsQuery.data,
      events: highlightedEvents,
      runtimeErrors: runtimeErrorsQuery.data,
      runtimeHealth: runtimeHealthQuery.data,
    }),
    runtimeErrorsQuery,
    runtimeHealthQuery,
  }
}

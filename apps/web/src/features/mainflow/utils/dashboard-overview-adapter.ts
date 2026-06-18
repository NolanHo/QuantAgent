import type { ApprovalListResponseDto } from '@/features/approvals/api/approval-workbench.contracts'
import { mapApprovalSummary } from '@/features/approvals/api/approval-workbench.contracts'
import { sortApprovalWorkbenchItems } from '@/features/approvals/utils/approval-rules'
import type {
  RuntimeErrorSummary,
  RuntimeHealthSummary,
  RuntimeListResponse,
} from '@/features/runtime/api/runtime-inspect.contracts'

import type { DashboardMetric, DashboardOverview } from '../types/dashboard-overview.types'
import type { DashboardEventsSummary } from '../types/dashboard-event.types'

export function createDashboardOverview(params: {
  approvals: ApprovalListResponseDto | undefined
  events: DashboardEventsSummary
  runtimeErrors: RuntimeListResponse<RuntimeErrorSummary> | undefined
  runtimeHealth: RuntimeHealthSummary | undefined
}): DashboardOverview {
  const approvals = (params.approvals?.items ?? []).map(mapApprovalSummary)
  const pendingApprovals = sortApprovalWorkbenchItems(
    approvals.filter((item) => item.status === 'pending'),
    'recommendation',
  )
  const healthAlerts = buildHealthAlerts(params.runtimeHealth, params.runtimeErrors)

  return {
    approvalsQueue: pendingApprovals.slice(0, 3),
    healthAlerts,
    metrics: buildMetrics({
      eventCount: params.events.items.length,
      healthAlertCount: healthAlerts.length,
      pendingApprovals,
      runtimeHealth: params.runtimeHealth,
    }),
  }
}

function buildMetrics({
  eventCount,
  healthAlertCount,
  pendingApprovals,
  runtimeHealth,
}: {
  eventCount: number
  healthAlertCount: number
  pendingApprovals: ReturnType<typeof mapApprovalSummary>[]
  runtimeHealth: RuntimeHealthSummary | undefined
}): DashboardMetric[] {
  return [
    {
      label: '今日重点事件',
      value: formatCount(eventCount),
      trend: eventCount > 0 ? '来自后端 /events read model' : '当前没有后端重点事件',
    },
    {
      label: '待处理审批',
      value: formatCount(pendingApprovals.length),
      trend: `${pendingApprovals.filter((item) => item.expiresSoon).length} 条将在 60 分钟内过期`,
    },
    {
      label: '关键健康提醒',
      value: formatCount(healthAlertCount),
      trend: runtimeHealth ? `runtime 状态：${runtimeHealth.partial_status}` : 'runtime health 未返回',
    },
    {
      label: '待复核分析',
      value: formatCount(runtimeHealth?.recent_failed_agent_run_count ?? 0),
      trend: `${runtimeHealth?.recent_failed_tool_invocation_count ?? 0} 条工具失败摘要`,
    },
  ]
}

function buildHealthAlerts(
  runtimeHealth: RuntimeHealthSummary | undefined,
  runtimeErrors: RuntimeListResponse<RuntimeErrorSummary> | undefined,
): DashboardOverview['healthAlerts'] {
  const alerts: Array<DashboardOverview['healthAlerts'][number]> = []

  for (const error of runtimeErrors?.items ?? []) {
    alerts.push({
      id: error.error_id,
      severity: severityLabel(error.severity),
      title: `${error.component} · ${error.error_code}`,
      summary: error.error_message_summary,
      traceHint: error.trace_id ? `trace_id: ${error.trace_id}` : error.plugin_id ? `plugin_id: ${error.plugin_id}` : 'trace_id 未记录',
    })
  }

  if (runtimeErrors?.meta.unavailable) {
    alerts.push({
      id: 'runtime-errors-unavailable',
      severity: '中',
      title: 'Runtime error read model 不可用',
      summary: runtimeErrors.meta.unavailable.message,
      traceHint: runtimeErrors.meta.unavailable.reason,
    })
  }

  if (runtimeHealth && runtimeHealth.partial_status !== 'ready') {
    alerts.push({
      id: 'runtime-health-partial-status',
      severity: runtimeHealth.partial_status === 'unavailable' ? '高' : '中',
      title: 'Runtime health 非 ready',
      summary: runtimeHealth.unavailable_resources[0]?.message ?? `当前 runtime 状态为 ${runtimeHealth.partial_status}。`,
      traceHint: `generated_at: ${runtimeHealth.generated_at}`,
    })
  }

  return alerts.slice(0, 3)
}

function severityLabel(value: string): string {
  if (value === 'critical' || value === 'high') return '高'
  if (value === 'warning' || value === 'medium') return '中'
  return '低'
}

function formatCount(value: number): string {
  return String(value).padStart(2, '0')
}

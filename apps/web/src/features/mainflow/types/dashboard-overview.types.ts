import type { ApprovalWorkbenchItem } from '@/features/approvals/types/approval-workbench.types'

export interface DashboardMetric {
  label: string
  value: string
  trend: string
}

export interface DashboardHealthAlert {
  id: string
  title: string
  severity: string
  summary: string
  traceHint: string
  relatedRunId?: string
}

export interface DashboardOverview {
  approvalsQueue: readonly ApprovalWorkbenchItem[]
  healthAlerts: readonly DashboardHealthAlert[]
  metrics: readonly DashboardMetric[]
}

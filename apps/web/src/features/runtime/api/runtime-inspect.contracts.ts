export interface RuntimeHealthSummary {
  active_agent_run_count: number
  backend_status: {
    api: 'degraded' | 'healthy' | 'not_configured' | 'unavailable'
    scheduler: 'degraded' | 'healthy' | 'not_configured' | 'unavailable'
    worker: 'degraded' | 'healthy' | 'not_configured' | 'unavailable'
  }
  generated_at: string
  partial_status: 'degraded' | 'ready' | 'unavailable'
  recent_failed_agent_run_count: number
  recent_failed_tool_invocation_count: number
  runtime_error_severity_summary: {
    critical: number
    info: number
    warning: number
  }
  unavailable_resources: Array<{
    message: string
    reason: string
    status: 'degraded' | 'ready' | 'unavailable'
  }>
  websocket_status_hint: 'connected' | 'degraded' | 'unknown'
}

export interface RuntimeErrorSummary {
  component: string
  created_at: string
  error_code: string
  error_id: string
  error_message_summary: string
  event_id: string | null
  plugin_id: string | null
  provider: string | null
  provider_policy: string | null
  severity: string
  status: string
  trace_id: string | null
}

export interface RuntimeListResponse<TItem> {
  items: TItem[]
  meta: {
    page: {
      next_cursor: string | null
      page: number
      page_size: number
      returned: number
    }
    state: 'empty' | 'ready' | 'unavailable'
    unavailable: {
      message: string
      reason: string
      status: 'degraded' | 'ready' | 'unavailable'
    } | null
  }
}

export interface RuntimeErrorListParams {
  component?: string
  event_id?: string
  page?: number
  page_size?: number
  plugin_id?: string
  severity?: string
  status?: string
  time_from?: string
  time_to?: string
  trace_id?: string
}

export interface RuntimeInspectApiContract {
  getRuntimeHealth(): Promise<RuntimeHealthSummary>
  listRuntimeErrors(params?: RuntimeErrorListParams): Promise<RuntimeListResponse<RuntimeErrorSummary>>
}

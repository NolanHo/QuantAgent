export function ApprovalErrorState({
  message,
  requestId,
  traceId,
}: {
  message: string
  requestId: string
  traceId: string
}) {
  return (
    <section className="rounded-xl border border-trading-down/25 bg-trading-down/5 p-4">
      <div className="grid gap-2">
        <h2 className="m-0 text-title-sm font-bold text-ink">审批动作失败</h2>
        <p className="m-0 text-body-sm text-muted">{message}</p>
        <p className="m-0 text-[12px] text-muted">
          request_id：{requestId} · trace_id：{traceId}
        </p>
      </div>
    </section>
  )
}

export function ApprovalPermissionState() {
  return (
    <section className="rounded-xl border border-hairline bg-canvas p-4">
      <div className="grid gap-2">
        <h2 className="m-0 text-title-sm font-bold text-ink">审批能力受限</h2>
        <p className="m-0 text-body-sm text-muted">
          当前账号没有足够的审批能力，动作区应保持禁用，并展示 request_id / trace_id 供后端排查。
        </p>
        <p className="m-0 text-[12px] text-muted">
          request_id：req-permission-preview · trace_id：trace-permission-preview
        </p>
      </div>
    </section>
  )
}

import {
  maskApprovalTraceIdentifier,
  toSafeApprovalErrorMessage,
} from '../../utils/approval-error-display'

export function ApprovalErrorState({
  message,
  requestId,
  traceId,
}: {
  message: string
  requestId: string
  traceId: string
}) {
  // 中文注释：这里同时承接 transport error 和业务失败反馈，但都只展示白名单文案和截断排障 ID。
  const safeMessage = toSafeApprovalErrorMessage(message)
  const maskedRequestId = maskApprovalTraceIdentifier(requestId)
  const maskedTraceId = maskApprovalTraceIdentifier(traceId)

  return (
    <section className="rounded-xl border border-trading-down/25 bg-trading-down/5 p-4">
      <div className="grid gap-2">
        <h2 className="m-0 text-title-sm font-bold text-ink">审批动作失败</h2>
        <p className="m-0 text-body-sm text-muted">{safeMessage}</p>
        <p className="m-0 text-[12px] text-muted">
          request_id：{maskedRequestId} · trace_id：{maskedTraceId}
        </p>
      </div>
    </section>
  )
}

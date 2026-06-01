const safeMessageMap = {
  approval_action_failed: '审批动作提交失败，请重试或查看排障标识。',
  approval_not_pending: '当前审批已不处于待处理状态，无法再次提交动作。',
  reanalysis_reason_required: '请求重分析需要填写简短原因。',
} as const

export type ApprovalSafeErrorCode = keyof typeof safeMessageMap

export function toSafeApprovalErrorMessage(message: string) {
  return safeMessageMap[message as ApprovalSafeErrorCode] ?? '审批动作失败，请稍后重试或联系管理员。'
}

export function maskApprovalTraceIdentifier(value: string) {
  if (!value) return '不可用'
  const tail = value.slice(-6)
  return `****${tail}`
}

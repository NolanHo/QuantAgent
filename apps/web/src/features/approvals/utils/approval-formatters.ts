import type {
  ApprovalConfirmationLevel,
  ApprovalExpirationAction,
  ApprovalRiskDirection,
  ApprovalWorkbenchItem,
} from '../types/approval-workbench.types'

export function formatRiskDirectionLabel(value: ApprovalRiskDirection) {
  if (value === 'increase_risk') return '增加风险'
  if (value === 'reduce_risk') return '降低风险'
  return '中性'
}

export function formatConfirmationLabel(value: ApprovalConfirmationLevel) {
  if (value === 'strong_confirm') return '强确认'
  if (value === 'link_confirm') return '链接确认'
  return '仅人工'
}

export function formatExpirationActionLabel(value: ApprovalExpirationAction) {
  if (value === 'expire_and_notify') return '过期后通知'
  if (value === 'expire_and_archive') return '过期后归档'
  return '过期后要求重分析'
}

export function formatStatusLabel(value: ApprovalWorkbenchItem['status']) {
  if (value === 'pending') return '待处理'
  if (value === 'approved') return '已批准'
  if (value === 'rejected') return '已拒绝'
  if (value === 'expired') return '已过期'
  return '已请求重分析'
}

export function toActionCopy(action: 'approve' | 'reject' | 'request_reanalysis') {
  if (action === 'approve') return '批准只代表人工确认，不代表真实执行完成。'
  if (action === 'reject') return '拒绝后，该建议不会继续被视为已放行动作。'
  return '重分析会要求系统重新检查当前证据与时效。'
}

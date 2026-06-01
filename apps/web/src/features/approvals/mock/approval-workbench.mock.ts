import type {
  ApprovalActionResult,
  ApprovalActionType,
  ApprovalLinkContext,
  ApprovalWorkbenchItem,
} from '../types/approval-workbench.types'

const initialItems: ApprovalWorkbenchItem[] = [
  {
    id: 'apr-semiconductor-01',
    eventId: 'evt-semiconductor-export',
    eventTitle: '北美半导体出口限制升级，设备链预期再下修',
    source: '全球财经快讯',
    actionLabel: '降低半导体设备板块风险暴露',
    recommendationScore: 78,
    recommendationLabel: '78 / 100',
    eventCredibility: '高可信',
    analysisConfidence: '74 / 100',
    riskDirection: 'increase_risk',
    riskLevel: '高',
    riskScore: 90,
    expiresInLabel: '18 分钟',
    expiresAtLabel: '2026-05-28 10:42',
    expiresSoon: true,
    expirationAction: 'expire_and_notify',
    confirmationLevel: 'strong_confirm',
    triggerSummary: '高价值事件触发的高风险减仓建议',
    status: 'pending',
    createdAt: '2026-05-28 10:24',
    createdOrder: 3,
    requiresSecondConfirm: true,
  },
  {
    id: 'apr-memory-02',
    eventId: 'evt-semiconductor-memory',
    eventTitle: '存储厂启动新一轮报价试探，NAND 现货价格继续抬升',
    source: '渠道报价监测',
    actionLabel: '请求重分析并补充库存去化验证',
    recommendationScore: 63,
    recommendationLabel: '63 / 100',
    eventCredibility: '中高可信',
    analysisConfidence: '61 / 100',
    riskDirection: 'neutral',
    riskLevel: '中',
    riskScore: 58,
    expiresInLabel: '45 分钟',
    expiresAtLabel: '2026-05-28 11:09',
    expiresSoon: false,
    expirationAction: 'expire_reanalysis',
    confirmationLevel: 'manual_only',
    triggerSummary: '分析存在数据缺口，先补齐证据再进入动作确认',
    status: 'pending',
    createdAt: '2026-05-28 09:57',
    createdOrder: 2,
    requiresSecondConfirm: false,
    batchBlockReason: 'manual_only 必须逐条处理',
  },
  {
    id: 'apr-foundry-03',
    eventId: 'evt-semiconductor-foundry',
    eventTitle: '晶圆代工厂传出下季成熟制程议价松动，功率器件链承压',
    source: '产业链跟踪',
    actionLabel: '维持减仓建议并等待二次确认',
    recommendationScore: 70,
    recommendationLabel: '70 / 100',
    eventCredibility: '中可信',
    analysisConfidence: '66 / 100',
    riskDirection: 'reduce_risk',
    riskLevel: '中',
    riskScore: 69,
    expiresInLabel: '2 小时',
    expiresAtLabel: '2026-05-28 12:08',
    expiresSoon: false,
    expirationAction: 'expire_and_notify',
    confirmationLevel: 'link_confirm',
    triggerSummary: '建议方向清晰，但需要受限确认入口完成二次确认',
    status: 'pending',
    createdAt: '2026-05-28 09:43',
    createdOrder: 1,
    requiresSecondConfirm: false,
  },
  {
    id: 'apr-network-04',
    eventId: 'evt-network-latency',
    eventTitle: '关键数据源出现延迟，事件链路需要人工确认是否继续使用当前建议',
    source: '运行时告警聚合',
    actionLabel: '拒绝沿用当前建议并等待新的分析快照',
    recommendationScore: 52,
    recommendationLabel: '52 / 100',
    eventCredibility: '中可信',
    analysisConfidence: '48 / 100',
    riskDirection: 'increase_risk',
    riskLevel: '高',
    riskScore: 84,
    expiresInLabel: '已过期',
    expiresAtLabel: '2026-05-28 09:08',
    expiresSoon: false,
    expirationAction: 'expire_and_archive',
    confirmationLevel: 'strong_confirm',
    triggerSummary: '原始数据延迟导致建议时效性失真，当前审批仅保留为历史上下文',
    status: 'expired',
    createdAt: '2026-05-28 08:34',
    createdOrder: 0,
    requiresSecondConfirm: true,
    batchBlockReason: '已过期审批不可加入批量处理',
  },
]

function cloneItems(items: readonly ApprovalWorkbenchItem[]) {
  return items.map((item) => ({
    ...item,
    actionError: item.actionError ? { ...item.actionError } : null,
  }))
}

let mockItems = cloneItems(initialItems)

const approvalLinkContexts: Record<string, ApprovalLinkContext> = {
  'preview-token': {
    status: 'valid',
    approvalId: 'apr-foundry-03',
    eventId: 'evt-semiconductor-foundry',
    eventTitle: '晶圆代工厂传出下季成熟制程议价松动，功率器件链承压',
    actionLabel: '维持减仓建议并等待二次确认',
    riskDirection: 'reduce_risk',
    riskLevel: '中',
    confirmationLevel: 'link_confirm',
    expirationAction: 'expire_and_notify',
    expiresInLabel: '2 小时',
    triggerSummary: '建议方向清晰，但需要受限确认入口完成二次确认',
    requestId: 'req-link-preview',
    actionDisabled: false,
  },
  'manual-only-token': {
    status: 'permission_mismatch',
    approvalId: 'apr-memory-02',
    eventId: 'evt-semiconductor-memory',
    eventTitle: '存储厂启动新一轮报价试探，NAND 现货价格继续抬升',
    actionLabel: '请求重分析并补充库存去化验证',
    riskDirection: 'neutral',
    riskLevel: '中',
    confirmationLevel: 'manual_only',
    expirationAction: 'expire_reanalysis',
    expiresInLabel: '45 分钟',
    triggerSummary: '分析存在数据缺口，先补齐证据再进入动作确认',
    requestId: 'req-link-manual-only',
    actionDisabled: true,
    disabledReason: '当前审批要求 manual_only，只能回到后台详情完成强确认。',
  },
  'strong-confirm-token': {
    status: 'permission_mismatch',
    approvalId: 'apr-semiconductor-01',
    eventId: 'evt-semiconductor-export',
    eventTitle: '北美半导体出口限制升级，设备链预期再下修',
    actionLabel: '降低半导体设备板块风险暴露',
    riskDirection: 'increase_risk',
    riskLevel: '高',
    confirmationLevel: 'strong_confirm',
    expirationAction: 'expire_and_notify',
    expiresInLabel: '18 分钟',
    triggerSummary: '高价值事件触发的高风险减仓建议',
    requestId: 'req-link-strong-confirm',
    actionDisabled: true,
    disabledReason: '当前审批要求 strong_confirm，一次性链接不能替代后台强确认入口。',
  },
  'expired-token': {
    status: 'expired',
    approvalId: 'apr-network-04',
    eventId: 'evt-network-latency',
    eventTitle: '关键数据源出现延迟，事件链路需要人工确认是否继续使用当前建议',
    actionLabel: '拒绝沿用当前建议并等待新的分析快照',
    riskDirection: 'increase_risk',
    riskLevel: '高',
    confirmationLevel: 'link_confirm',
    expirationAction: 'expire_and_archive',
    expiresInLabel: '已过期',
    triggerSummary: '原始数据延迟导致建议时效性失真，当前审批仅保留为历史上下文',
    requestId: 'req-link-expired',
    actionDisabled: true,
    disabledReason: '当前链接已过期，需回到后台查看 expiration_action 结果。',
  },
}

export function listApprovalWorkbenchItems() {
  return cloneItems(mockItems)
}

export function getApprovalWorkbenchItem(approvalId: string) {
  const item = mockItems.find((candidate) => candidate.id === approvalId)
  return item ? { ...item, actionError: item.actionError ? { ...item.actionError } : null } : null
}

export function getApprovalLinkContext(token: string): ApprovalLinkContext {
  return (
    approvalLinkContexts[token] ?? {
      status: 'invalid',
      approvalId: 'unknown',
      eventId: 'unknown',
      eventTitle: '未找到关联审批',
      actionLabel: '无法解析当前链接',
      riskDirection: 'neutral',
      riskLevel: '低',
      confirmationLevel: 'link_confirm',
      expirationAction: 'expire_and_notify',
      expiresInLabel: '未知',
      triggerSummary: '当前 token 无效、已撤销或未换取到受限审批上下文。',
      requestId: 'req-link-invalid',
      actionDisabled: true,
      disabledReason: '当前链接无效，请返回登录后从审批工作台重新进入。',
    }
  )
}

export function resetApprovalWorkbenchMock() {
  mockItems = cloneItems(initialItems)
}

export function runApprovalAction(params: {
  action: ApprovalActionType
  approvalIds: string[]
  reason?: string
}): ApprovalActionResult {
  const { action, approvalIds, reason } = params

  const nextItems = cloneItems(mockItems)
  const appliedIds: string[] = []
  const failedIds: string[] = []

  for (const approvalId of approvalIds) {
    const item = nextItems.find((candidate) => candidate.id === approvalId)
    if (!item) {
      failedIds.push(approvalId)
      continue
    }

    if (item.status !== 'pending') {
      item.actionError = {
        message: '当前审批已不处于待处理状态，无法再次提交动作。',
        requestId: `req-${approvalId}`,
        traceId: `trace-${approvalId}`,
      }
      failedIds.push(approvalId)
      continue
    }

    if (action === 'request_reanalysis' && !reason?.trim()) {
      item.actionError = {
        message: 'request_reanalysis 需要填写简短原因。',
        requestId: `req-${approvalId}`,
        traceId: `trace-${approvalId}`,
      }
      failedIds.push(approvalId)
      continue
    }

    // 中文注释：这里故意只模拟审批状态变化，不伪造真实执行完成，避免越过 Policy Gate 语义边界。
    if (action === 'approve') {
      item.status = 'approved'
    } else if (action === 'reject') {
      item.status = 'rejected'
    } else {
      item.status = 'reanalysis_requested'
      item.triggerSummary = `${item.triggerSummary} · 重分析原因：${reason?.trim()}`
    }

    item.actionError = null
    appliedIds.push(approvalId)
  }

  mockItems = nextItems

  return {
    action,
    appliedIds,
    failedIds,
    message:
      action === 'approve'
        ? '已记录人工批准。批准只代表人工确认，不代表真实执行完成。'
        : action === 'reject'
          ? '已记录人工拒绝。该建议不会被继续视为已放行动作。'
          : '已记录重分析请求。系统需要基于新证据重新生成建议。',
  }
}

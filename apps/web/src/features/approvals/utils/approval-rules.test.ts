import { describe, expect, it } from 'vitest'

import {
  getApprovalLinkContext,
  listApprovalWorkbenchItems,
  runApprovalAction,
} from '../mock/approval-workbench.mock'
import {
  computeBatchEligibility,
  filterApprovalWorkbenchItems,
  sortApprovalWorkbenchItems,
} from './approval-rules'

describe('approval-rules', () => {
  it('defaults recommendation sorting to highest score first', () => {
    const items = listApprovalWorkbenchItems()
    const sorted = sortApprovalWorkbenchItems(items, 'recommendation')

    expect(sorted[0]?.id).toBe('apr-semiconductor-01')
    expect(sorted[1]?.id).toBe('apr-foundry-03')
  })

  it('filters pending approvals by default status', () => {
    const items = listApprovalWorkbenchItems()
    const filtered = filterApprovalWorkbenchItems(items, { status: 'pending' })

    expect(filtered.every((item) => item.status === 'pending')).toBe(true)
    expect(filtered.some((item) => item.id === 'apr-network-04')).toBe(false)
  })

  it('blocks batch eligibility when a selection mixes manual_only with another confirmation level', () => {
    const items = listApprovalWorkbenchItems()
    const result = computeBatchEligibility(items, [
      'apr-semiconductor-01',
      'apr-memory-02',
    ])

    expect(result.eligibleIds).toEqual([])
    expect(result.issues.some((issue) => issue.approvalId === 'apr-memory-02')).toBe(true)
    expect(result.issues.some((issue) => issue.approvalId === 'apr-semiconductor-01')).toBe(true)
  })

  it('keeps eligible ids for future batch rules while excluding manual_only from execution set', () => {
    const items = listApprovalWorkbenchItems()
    const result = computeBatchEligibility(items, [
      'apr-foundry-03',
      'apr-memory-02',
    ])

    expect(result.eligibleIds).toEqual(['apr-foundry-03'])
    expect(result.issues).toContainEqual({
      approvalId: 'apr-memory-02',
      reason: 'manual_only 只能逐条处理',
    })
  })

  it('prevents approval-link from handling manual_only and strong_confirm contexts', () => {
    const manualOnly = getApprovalLinkContext('manual-only-token')
    const strongConfirm = getApprovalLinkContext('strong-confirm-token')

    expect(manualOnly.actionDisabled).toBe(true)
    expect(manualOnly.status).toBe('permission_mismatch')
    expect(strongConfirm.actionDisabled).toBe(true)
    expect(strongConfirm.status).toBe('permission_mismatch')
  })

  it('returns an invalid fallback when the approval-link token is unknown', () => {
    const context = getApprovalLinkContext('missing-token')

    expect(context.status).toBe('invalid')
    expect(context.actionDisabled).toBe(true)
    expect(context.disabledReason).toContain('无效')
  })

  it('returns structured failures for business-level action rejection', () => {
    const result = runApprovalAction({
      action: 'approve',
      approvalIds: ['apr-network-04'],
    })

    expect(result.appliedIds).toEqual([])
    expect(result.failedIds).toEqual(['apr-network-04'])
    expect(result.failures).toEqual([
      {
        message: 'approval_not_pending',
        requestId: 'req-apr-network-04',
        traceId: 'trace-apr-network-04',
      },
    ])
  })
})

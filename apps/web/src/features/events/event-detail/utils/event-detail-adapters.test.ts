import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  scoredApprovals,
  scoredEvents,
} from '@/features/event-scoring/mocks/event-scoring.mock'
import { runtimeAgentRuns } from '@/features/mainflow/mock-data'

import {
  createEventAuditPageModel,
  createEventDetailPageModel,
} from './event-detail-adapters'

describe('event detail adapters', () => {
  it('maps event detail into a page model without leaking raw lookup logic into views', () => {
    const model = createEventDetailPageModel(
      scoredEvents[0]!,
      scoredApprovals[0]!,
      runtimeAgentRuns[0]!,
    )

    expect(model.factSummary.verificationStatusLabel).toBe('双信源验证')
    expect(model.bestActionSummary.approvalStatus).toContain('strong_confirm')
    expect(model.argumentSummaries).toHaveLength(5)
    expect(model.runtimeSummary.runId).toBe(runtimeAgentRuns[0]!.id)
  })

  it('keeps missing approval and run states explicit', () => {
    const model = createEventDetailPageModel(
      scoredEvents[3]!,
      null,
      null,
    )

    expect(model.bestActionSummary.approvalStatus).toBe('当前暂无 ApprovalRequest')
    expect(model.runtimeSummary.runId).toBeNull()
    expect(model.runtimeSummary.summary).toContain('暂无关联 Agent Run')
  })

  it('maps audit summary links separately from detail rendering', () => {
    const model = createEventAuditPageModel(
      scoredEvents[2]!,
      scoredApprovals[2]!,
      null,
    )

    expect(model.summary.approvalId).toBe(scoredApprovals[2]!.id)
    expect(model.summary.runId).toBeNull()
  })
})

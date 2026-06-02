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
    expect(model.decisionSummary.impactQuestion).toContain('半导体设备')
    expect(model.impactSummary.affectedObjects).toContain('半导体设备链')
    expect(model.impactSummary.impactWindow).toContain('高时效窗口')
    expect(model.impactSummary.consensusSummary).toContain('出口限制升级')
    expect(model.impactSummary.divergenceSummary).toContain('兑现节奏')
    expect(model.bestActionSummary.actionTitle).toBe(scoredApprovals[0]!.actionLabel)
    expect(model.bestActionSummary.triggerSummary).toBe(scoredApprovals[0]!.triggerSummary)
    expect(model.bestActionSummary.approvalStatus).toContain('强确认')
    expect(model.bestActionSummary.approvalId).toBe(scoredApprovals[0]!.id)
    expect(model.evidenceSummary.evidenceQuality).toContain('双信源交叉验证')
    expect(model.argumentSummaries).toHaveLength(6)
    expect(model.runtimeSummary.runId).toBe(runtimeAgentRuns[0]!.id)
  })

  it('keeps missing approval and run states explicit', () => {
    const model = createEventDetailPageModel(
      scoredEvents[4]!,
      null,
      null,
    )

    expect(model.bestActionSummary.approvalStatus).toBe('当前暂无审批请求')
    expect(model.bestActionSummary.approvalId).toBeNull()
    expect(model.decisionSummary.currentBlocker).toContain('事件窗口已过')
    expect(model.impactSummary.riskPoints).toContain('事件窗口已过，当前仅保留审计和历史解释价值。')
    expect(model.runtimeSummary.runId).toBeNull()
    expect(model.runtimeSummary.summary).toContain('暂无关联运行摘要')
  })

  it('keeps conflicting evidence visible for manual confirmation', () => {
    const model = createEventDetailPageModel(
      scoredEvents[2]!,
      scoredApprovals[2]!,
      null,
    )

    expect(model.impactSummary.riskPoints).toEqual(expect.arrayContaining([
      expect.stringContaining('渠道消息和代工厂正式口径仍存在分歧'),
      expect.stringContaining('审批风险等级：中'),
      expect.stringContaining('渠道消息与正式口径存在分歧'),
    ]))
    expect(model.impactSummary.divergenceSummary).toContain('正式口径与渠道跟踪仍冲突')
    expect(model.evidenceSummary.evidenceQuality).toContain('信号冲突')
    expect(model.bestActionSummary.confirmationLevel).toBe('链接确认')
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

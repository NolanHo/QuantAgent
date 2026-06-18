import { describe, expect, it } from 'vitest'

import {
  mapApprovalActionResponse,
  mapApprovalListResponse,
  mapApprovalOverview,
  toApprovalActionPayload,
  toApprovalWorkbenchListParams,
  type ApprovalListResponseDto,
} from './approval-workbench.contracts'

const approvalListResponse: ApprovalListResponseDto = {
  items: [
    {
      id: 'approval-1',
      status: 'pending',
      target_type: 'instrument',
      target_id: 'NVDA',
      action_type: 'trade_plan',
      action_side: 'increase_risk',
      risk_level: 'high',
      urgency: 'normal',
      summary: 'NVDA dry-run plan',
      required_confirmation_level: 'strong_confirm',
      expires_at: '2026-06-18T12:00:00Z',
      expiration_action: 'expire_reject',
      created_at: '2026-06-18T10:00:00Z',
      updated_at: '2026-06-18T10:00:00Z',
      latest_decision_summary: {
        status: 'pending',
        reason_summary: 'Approval request is pending human input.',
        policy_gate_status: 'not_required',
        execution_status: 'not_requested',
      },
      allowed_actions: ['approve', 'reject', 'request-reanalysis'],
    },
  ],
}

describe('approval workbench API contracts', () => {
  it('maps list response into UI workbench items', () => {
    const items = mapApprovalListResponse(approvalListResponse, { status: 'pending', sort: 'recommendation' })

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      id: 'approval-1',
      eventId: 'NVDA',
      riskDirection: 'increase_risk',
      riskLevel: '高',
      confirmationLevel: 'strong_confirm',
      status: 'pending',
    })
  })

  it('maps overview from real REST response items', () => {
    expect(mapApprovalOverview(approvalListResponse)).toEqual({
      pendingCount: 1,
      expiringSoonCount: 0,
      highRiskCount: 1,
      strongConfirmationCount: 1,
    })
  })

  it('maps search params and action payloads to backend contract', () => {
    expect(toApprovalWorkbenchListParams({ status: 'approved', confirmation: 'strong_confirm', sort: 'latest' })).toEqual({
      status: 'completed',
      required_confirmation_level: 'strong_confirm',
      sort: '-updated_at',
      limit: 100,
    })
    expect(toApprovalActionPayload('request_reanalysis', 'need more evidence')).toEqual({
      channel: 'web',
      reason: 'need more evidence',
      structured_payload: { intent: 'request_reanalysis' },
    })
  })

  it('aggregates action response without treating execution as trading success', () => {
    const result = mapApprovalActionResponse('approve', ['approval-1'], [
      {
        ignored: false,
        decision: {
          status: 'execution_requested',
          reason_summary: 'Dry-run execution requested.',
          policy_gate_status: 'allowed',
          execution_status: 'dry_run_requested',
        },
      },
    ])

    expect(result.appliedIds).toEqual(['approval-1'])
    expect(result.message).toBe('approval_action_submitted')
  })
})

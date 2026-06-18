import { describe, expect, it } from 'vitest'

import {
  mapApprovalActionResponse,
  mapApprovalDetail,
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

  it('maps approval detail action plan summary for the detail page', () => {
    const detail = mapApprovalDetail({
      ...approvalListResponse.items[0],
      action_request_summary: {
        id: 'action-1',
        action_side: 'increase_risk',
        proposed_payload_summary: {
          broker_mode: 'dry_run',
          idempotency_key: 'evt-1:plan-1',
          action_plan_summary: {
            action_plan_artifact_id: 'artifact-action-plan-1',
            summary: 'NVDA high-conviction dry-run plan',
            intent: 'trade',
            intended_action: 'open_long',
            action_side: 'increase_risk',
            target_symbols: ['NVDA'],
            orders: [
              {
                symbol: 'NVDA',
                side: 'buy',
                order_intent: 'open',
                notional_usd: 9500,
                portfolio_pct: 0.095,
                order_type: 'market',
                time_in_force: 'day',
              },
            ],
            risk_controls: {
              stop_loss_pct: -4.5,
              take_profit_pct: 8,
              invalidation_conditions: ['guidance weakened'],
            },
            monitoring_plan: {
              watch_symbols: ['NVDA'],
              watch_topics: ['earnings_call'],
              duration: '24h',
            },
            user_notification: {
              delivery_policy: 'send',
              title: 'NVDA 财报行动计划',
              summary: '需要人工审批。',
            },
            constraints: ['broker_mode=dry_run'],
          },
        },
      },
      allowed_channels: ['web'],
      policy_source: 'system_default',
      inputs: [],
      evaluations: [],
      decisions: [],
      audit_refs: [],
    })

    expect(detail.actionPlan).toMatchObject({
      artifactId: 'artifact-action-plan-1',
      brokerMode: 'dry_run',
      idempotencyKey: 'evt-1:plan-1',
      targetSymbols: ['NVDA'],
      orders: [{ symbol: 'NVDA', notionalUsd: 9500, portfolioPct: 0.095 }],
      riskControls: { stopLossPct: -4.5, takeProfitPct: 8 },
      monitoringPlan: { watchTopics: ['earnings_call'], duration: '24h' },
    })
  })
})

import { describe, expect, it, vi } from 'vitest'

import type { ApiClient } from '@/shared/api'

import { ApprovalWorkbenchApi } from './approval-workbench.api'

function createApiClientMock(): ApiClient {
  return {
    del: vi.fn(),
    get: vi.fn(),
    instance: {} as ApiClient['instance'],
    patch: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    request: vi.fn(),
    requestEnvelope: vi.fn(),
    stream: vi.fn(),
  }
}

describe('ApprovalWorkbenchApi', () => {
  it('uses real approval REST endpoints instead of fixture data', async () => {
    const client = createApiClientMock()
    vi.mocked(client.get).mockResolvedValueOnce({ items: [], next_cursor: null })
    vi.mocked(client.get).mockResolvedValueOnce({ id: 'approval-1' })
    vi.mocked(client.post).mockResolvedValue({ ignored: false })
    const api = new ApprovalWorkbenchApi(client)

    await api.listApprovals({ status: 'pending', limit: 100 })
    await api.getApproval('approval/1')
    await api.submitAction({ action: 'request_reanalysis', approvalId: 'approval/1', reason: 'need more evidence' })

    expect(client.get).toHaveBeenNthCalledWith(1, '/approvals', {
      params: { status: 'pending', limit: 100 },
    })
    expect(client.get).toHaveBeenNthCalledWith(2, '/approvals/approval%2F1', undefined)
    expect(client.post).toHaveBeenCalledWith('/approvals/approval%2F1/actions/request-reanalysis', {
      channel: 'web',
      reason: 'need more evidence',
      structured_payload: { intent: 'request_reanalysis' },
    }, undefined)
  })
})

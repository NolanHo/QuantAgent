import { BaseApi, type ApiClient } from '@/shared/api'

import type {
  ApprovalActionResponseDto,
  ApprovalDetailDto,
  ApprovalListResponseDto,
  ApprovalWorkbenchListParams,
} from './approval-workbench.contracts'
import { toApprovalActionPayload } from './approval-workbench.contracts'
import type { ApprovalActionType } from '../types/approval-workbench.types'

export class ApprovalWorkbenchApi extends BaseApi {
  constructor(apiClient: ApiClient) {
    super(apiClient, { basePath: '/approvals' })
  }

  listApprovals(params: ApprovalWorkbenchListParams = {}): Promise<ApprovalListResponseDto> {
    return this.get<ApprovalListResponseDto>('', { params })
  }

  getApproval(approvalId: string): Promise<ApprovalDetailDto> {
    return this.get<ApprovalDetailDto>(`/${encodeURIComponent(approvalId)}`)
  }

  submitAction({
    action,
    approvalId,
    reason,
  }: {
    action: ApprovalActionType
    approvalId: string
    reason?: string
  }): Promise<ApprovalActionResponseDto> {
    const pathAction = action === 'request_reanalysis' ? 'request-reanalysis' : action
    return this.post(`/${encodeURIComponent(approvalId)}/actions/${pathAction}`, toApprovalActionPayload(action, reason))
  }
}

export function createApprovalWorkbenchApi(apiClient: ApiClient): ApprovalWorkbenchApi {
  return new ApprovalWorkbenchApi(apiClient)
}

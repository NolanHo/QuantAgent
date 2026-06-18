import { describe, expect, it, vi } from 'vitest'

import { approvalWorkbenchKeys } from '../queries/approval-workbench.keys'
import { invalidateApprovalWorkbenchActionQueries } from './use-approval-workbench-action'

describe('invalidateApprovalWorkbenchActionQueries', () => {
  it('invalidates overview, lists, and each affected detail query', () => {
    const queryClient = {
      invalidateQueries: vi.fn(),
    }

    invalidateApprovalWorkbenchActionQueries(queryClient, ['approval-1', 'approval-2'])

    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(4)
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: approvalWorkbenchKeys.overview(),
    })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: approvalWorkbenchKeys.lists(),
    })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: approvalWorkbenchKeys.detail('approval-1'),
    })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: approvalWorkbenchKeys.detail('approval-2'),
    })
  })
})

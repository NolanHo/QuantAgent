import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

describe('useApprovalWorkbenchListQuery source boundary', () => {
  it('calls the runtime approval API and does not import mock workbench fixtures', () => {
    const sourcePath = fileURLToPath(new URL('./use-approval-workbench-list.ts', import.meta.url))
    const source = readFileSync(sourcePath, 'utf8')

    expect(source).toContain('useApis')
    expect(source).toContain('approvalWorkbench.listApprovals')
    expect(source).not.toContain('approval-workbench.mock')
    expect(source).not.toContain('mockApprovalWorkbenchItems')
  })
})

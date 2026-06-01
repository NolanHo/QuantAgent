import { useQuery } from '@tanstack/react-query'

import { getApprovalLinkContext } from '../mock/approval-workbench.mock'
import { approvalWorkbenchKeys } from './approval-workbench.keys'

function createLinkContextCacheKey(token: string) {
  let hash = 0
  for (const char of token) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  }
  // 中文注释：query key 只需要稳定区分链接上下文，不能把一次性 token 原文留进 cache/devtools。
  return `${token.length}:${hash.toString(36)}`
}

export function useApprovalLinkContextQuery(token: string) {
  return useQuery({
    queryFn: () => getApprovalLinkContext(token),
    queryKey: approvalWorkbenchKeys.linkContext(createLinkContextCacheKey(token)),
  })
}

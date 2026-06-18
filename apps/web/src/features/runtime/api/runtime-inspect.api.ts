import { BaseApi, type ApiClient } from '@/shared/api'

import type {
  RuntimeErrorListParams,
  RuntimeErrorSummary,
  RuntimeHealthSummary,
  RuntimeInspectApiContract,
  RuntimeListResponse,
} from './runtime-inspect.contracts'

export class RuntimeInspectApi extends BaseApi implements RuntimeInspectApiContract {
  constructor(apiClient: ApiClient) {
    super(apiClient, { basePath: '/runtime' })
  }

  getRuntimeHealth(): Promise<RuntimeHealthSummary> {
    return this.get<RuntimeHealthSummary>('/health')
  }

  listRuntimeErrors(params: RuntimeErrorListParams = {}): Promise<RuntimeListResponse<RuntimeErrorSummary>> {
    return this.get<RuntimeListResponse<RuntimeErrorSummary>>('/errors', { params: { ...params } })
  }
}

export function createRuntimeInspectApi(apiClient: ApiClient): RuntimeInspectApi {
  return new RuntimeInspectApi(apiClient)
}

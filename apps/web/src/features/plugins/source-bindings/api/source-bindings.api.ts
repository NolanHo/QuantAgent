import { BaseApi, type ApiClient } from "@/shared/api";

import type {
  SourceBindingListParams,
  SourceBindingListResponse,
} from "./source-bindings.contracts";

export class SourceBindingsApi extends BaseApi {
  constructor(apiClient: ApiClient) {
    super(apiClient, { basePath: "/source-bindings" });
  }

  listBindings(params: SourceBindingListParams = {}): Promise<SourceBindingListResponse> {
    return this.get<SourceBindingListResponse>("/", {
      dedupeKey: `source-bindings:${params.ownerType ?? "any"}:${params.ownerId ?? "any"}:${params.sourcePluginId ?? "any"}:${params.status ?? "any"}:${params.limit ?? "any"}`,
      params: {
        limit: params.limit ?? 50,
        owner_id: params.ownerId,
        owner_type: params.ownerType,
        source_plugin_id: params.sourcePluginId,
        status: params.status,
      },
    });
  }
}

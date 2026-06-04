import { BaseApi, type ApiClient } from "@/shared/api";

import type {
  PluginAuditViewResponse,
  PluginConfigViewResponse,
  PluginDependenciesViewResponse,
  PluginDetailResponse,
  PluginHealthViewResponse,
} from "./plugin-detail.contracts";

export class PluginDetailApi extends BaseApi {
  constructor(apiClient: ApiClient) {
    super(apiClient, { basePath: "/plugins" });
  }

  getDetail(pluginId: string): Promise<PluginDetailResponse> {
    return this.get<PluginDetailResponse>(`/${pluginId}`, {
      dedupeKey: `plugin-detail:${pluginId}`,
    });
  }

  getConfig(pluginId: string): Promise<PluginConfigViewResponse> {
    return this.get<PluginConfigViewResponse>(`/${pluginId}/config`, {
      dedupeKey: `plugin-detail-config:${pluginId}`,
    });
  }

  getDependencies(pluginId: string): Promise<PluginDependenciesViewResponse> {
    return this.get<PluginDependenciesViewResponse>(`/${pluginId}/dependencies`, {
      dedupeKey: `plugin-detail-dependencies:${pluginId}`,
    });
  }

  getHealth(pluginId: string): Promise<PluginHealthViewResponse> {
    return this.get<PluginHealthViewResponse>(`/${pluginId}/health`, {
      dedupeKey: `plugin-detail-health:${pluginId}`,
    });
  }

  getAudit(pluginId: string): Promise<PluginAuditViewResponse> {
    return this.get<PluginAuditViewResponse>(`/${pluginId}/audit`, {
      dedupeKey: `plugin-detail-audit:${pluginId}`,
    });
  }
}

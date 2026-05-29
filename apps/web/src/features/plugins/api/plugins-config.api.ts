import { BaseApi, type ApiClient } from "@/shared/api";

import type {
  PluginConfigSchemaResponse,
  PluginConfigSnapshotResponse,
  PluginConfigUpdateRequest,
  PluginConfigUpdateResponse,
  PluginConfigValidateRequest,
  PluginConfigValidateResponse,
} from "./contracts";

export class PluginConfigApi extends BaseApi {
  constructor(apiClient: ApiClient) {
    super(apiClient, { basePath: "/plugins" });
  }

  fetchConfig(pluginId: string): Promise<PluginConfigSnapshotResponse> {
    return this.get<PluginConfigSnapshotResponse>(`/${pluginId}/config`, {
      dedupeKey: `plugin-config:${pluginId}`,
    });
  }

  fetchConfigSchema(pluginId: string): Promise<PluginConfigSchemaResponse> {
    return this.get<PluginConfigSchemaResponse>(`/${pluginId}/config-schema`, {
      dedupeKey: `plugin-config-schema:${pluginId}`,
    });
  }

  updateConfig(
    pluginId: string,
    payload: PluginConfigUpdateRequest,
  ): Promise<PluginConfigUpdateResponse> {
    return this.put<PluginConfigUpdateRequest, PluginConfigUpdateResponse>(
      `/${pluginId}/config`,
      payload,
      { dedupeKey: false },
    );
  }

  validateConfig(
    pluginId: string,
    payload: PluginConfigValidateRequest,
  ): Promise<PluginConfigValidateResponse> {
    return this.post<PluginConfigValidateRequest, PluginConfigValidateResponse>(
      `/${pluginId}/config:validate`,
      payload,
      { dedupeKey: false },
    );
  }
}

export interface PluginConfigApiContract {
  fetchConfig(pluginId: string): Promise<PluginConfigSnapshotResponse>;
  fetchConfigSchema(pluginId: string): Promise<PluginConfigSchemaResponse>;
  updateConfig(
    pluginId: string,
    payload: PluginConfigUpdateRequest,
  ): Promise<PluginConfigUpdateResponse>;
  validateConfig(
    pluginId: string,
    payload: PluginConfigValidateRequest,
  ): Promise<PluginConfigValidateResponse>;
}

export function createPluginConfigApi(apiClient: ApiClient): PluginConfigApi {
  return new PluginConfigApi(apiClient);
}

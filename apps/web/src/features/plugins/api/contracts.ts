import type { PluginConfigJsonSchema, PluginConfigValueMap } from "../config-form/types/plugin-config.types";

export type PluginConfigSnapshotResponse = {
  masked_paths?: string[];
  updated_at?: string;
  values: PluginConfigValueMap;
  version_tag?: string;
};

export type PluginConfigValidateRequest = {
  values: Record<string, unknown>;
};

export type PluginConfigValidateResponse = {
  issues?: Array<{
    message: string;
    path: string;
  }>;
  ok?: boolean;
};

export type PluginConfigUpdateRequest = {
  values: Record<string, unknown>;
};

export type PluginConfigUpdateResponse = {
  updated_at?: string;
  version_tag?: string;
};

export type PluginConfigSchemaResponse = PluginConfigJsonSchema;

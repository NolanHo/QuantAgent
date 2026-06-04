import type {
  PluginConfigJsonSchema,
  PluginConfigValueMap,
} from "../config-form/types/plugin-config.types";

export type PluginType = "source" | "industry" | "strategy" | "notification" | "broker" | string;

export type PluginStatus =
  | "discovered"
  | "valid"
  | "invalid"
  | "enabled"
  | "disabled"
  | "failed"
  | string;

export type PluginSource = "official" | "runtime" | string;

export type PluginErrorResponse = {
  code: string;
  details?: Record<string, unknown>;
  message: string;
  retryable?: boolean;
  stage: string;
};

export type SourceBindingManifestResponse = {
  config_template: string;
  required: boolean;
  source_plugin_id: string;
};

export type PluginManifestResponse = {
  capabilities: string[];
  config_schema: string;
  dependencies: Record<string, unknown>;
  description?: string | null;
  entrypoint: string;
  id: string;
  name: string;
  permissions: string[];
  source_bindings: SourceBindingManifestResponse[];
  type: PluginType;
  version: string;
};

export type PluginRecordResponse = {
  id: string;
  last_error?: PluginErrorResponse | null;
  manifest?: PluginManifestResponse | null;
  path: string;
  source: PluginSource;
  status: PluginStatus;
};

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

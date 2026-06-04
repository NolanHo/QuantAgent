import type { PluginType } from "../../api/contracts";

export type SectionAvailabilityState =
  | "ready"
  | "not_configured"
  | "not_collected"
  | "forbidden"
  | "unavailable"
  | "degraded";

export type ConfigState =
  | "valid"
  | "invalid"
  | "missing_required"
  | "not_configured"
  | "unavailable";

export type HealthStatus = "healthy" | "degraded" | "failed" | "not_collected" | "unavailable";

export type PluginAction = "enable" | "disable" | "reload" | "rescan" | "uninstall";

export type SectionAvailability = {
  message?: string | null;
  reason_code?: string | null;
  state: SectionAvailabilityState;
};

export type PluginErrorSummary = {
  code: string;
  details?: Record<string, unknown>;
  message: string;
  retryable?: boolean;
  stage: string;
};

export type PluginOverview = {
  active_config_state: ConfigState;
  active_version?: string | null;
  blocked_reason?: string | null;
  description?: string | null;
  installed_version?: string | null;
  last_error_summary?: PluginErrorSummary | null;
  name: string;
  plugin_id: string;
  source: string;
  status: string;
  type: PluginType;
};

export type PluginConfigSummary = {
  availability: SectionAvailability;
  config_state: ConfigState;
  last_updated_at?: string | null;
  last_validated_at?: string | null;
  masked_sensitive_count: number;
  missing_required_count: number;
  reload_required: boolean;
  schema_version?: string | null;
};

export type PluginDependencySummary = {
  availability: SectionAvailability;
  blocked_reason_summary?: string | null;
  missing_count: number;
  optional_count: number;
  required_count: number;
  reverse_dependency_count: number;
};

export type PluginCapabilityRecord = {
  availability_state: SectionAvailabilityState;
  kind: string;
  name: string;
  requires_approval: boolean;
  requires_policy_gate: boolean;
  risk_level: "low" | "medium" | "high";
};

export type PluginCapabilitiesView = {
  availability: SectionAvailability;
  declared_capabilities: PluginCapabilityRecord[];
  provided_objects_summary: Record<string, unknown>;
  requires_approval: boolean;
  requires_policy_gate: boolean;
  risk_level_summary: "low" | "medium" | "high";
};

export type PluginHealthSummary = {
  availability: SectionAvailability;
  degraded_reason?: string | null;
  last_check_at?: string | null;
  last_error_summary?: PluginErrorSummary | null;
  last_used_at?: string | null;
  latest_runtime_failure_ref?: string | null;
  recent_runtime_error_count: number;
  status: HealthStatus;
};

export type PluginAuditSummary = {
  availability: SectionAvailability;
  last_actor?: string | null;
  last_changed_at?: string | null;
  latest_audit_ref?: string | null;
  recent_action_types: string[];
};

export type PluginOpsSummary = {
  action_blockers: string[];
  availability: SectionAvailability;
  high_risk_actions: string[];
  operable_state: string;
  requires_confirmation: boolean;
};

export type PluginActionHint = {
  action: PluginAction;
  allowed: boolean;
  disabled_reason?: string | null;
  requires_confirmation: boolean;
};

export type PluginActionStateHint = {
  action: PluginAction;
  message?: string | null;
  reason_code?: string | null;
  state: SectionAvailabilityState;
};

export type PluginRelatedResources = {
  audit: string;
  config: string;
  config_schema: string;
  dependencies: string;
  health: string;
};

export type PluginDetailResponse = {
  action_state_hints: PluginActionStateHint[];
  allowed_actions: PluginActionHint[];
  audit_summary: PluginAuditSummary;
  capabilities: PluginCapabilitiesView;
  config_summary: PluginConfigSummary;
  dependency_summary: PluginDependencySummary;
  health_summary: PluginHealthSummary;
  ops_summary: PluginOpsSummary;
  overview: PluginOverview;
  related_resources: PluginRelatedResources;
};

export type PluginConfigEntry = {
  display_mode: "plain" | "masked" | "reference" | "unset";
  display_value?: string | null;
  is_overridden: boolean;
  is_required: boolean;
  is_sensitive: boolean;
  key: string;
};

export type PluginConfigViewResponse = {
  availability: SectionAvailability;
  config_state: ConfigState;
  entries: PluginConfigEntry[];
  last_updated_at?: string | null;
  last_validated_at?: string | null;
  reload_required: boolean;
  schema?: {
    schema_ref?: string | null;
    schema_version?: string | null;
    title?: string | null;
  } | null;
};

export type PluginDependencyRecord = {
  blocked_reason?: string | null;
  kind: "plugin" | "python" | "system" | "reverse_plugin";
  name: string;
  required: boolean;
  resolved_state: "resolved" | "missing" | "blocked" | "not_collected";
  version_range?: string | null;
};

export type PluginDependenciesViewResponse = {
  availability: SectionAvailability;
  plugin_dependencies: PluginDependencyRecord[];
  python_dependencies: PluginDependencyRecord[];
  reverse_dependencies: PluginDependencyRecord[];
  system_dependencies: PluginDependencyRecord[];
};

export type PluginHealthViewResponse = {
  availability: SectionAvailability;
  degraded_reason?: string | null;
  health_checks: Record<string, unknown>[];
  last_check_at?: string | null;
  last_error_summary?: PluginErrorSummary | null;
  last_used_at?: string | null;
  latest_runtime_failure_ref?: string | null;
  recent_runtime_error_count: number;
  recent_usage_summary: Record<string, unknown>;
  runtime_error_refs: string[];
  status: HealthStatus;
};

export type PluginAuditEntry = {
  action: string;
  actor: string;
  audit_id: string;
  occurred_at: string;
  result: string;
  safe_details: Record<string, unknown>;
};

export type PluginAuditViewResponse = {
  availability: SectionAvailability;
  entries: PluginAuditEntry[];
};

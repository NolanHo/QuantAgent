export type SourceBindingStatus = "active" | "paused" | "disabled";
export type SourceBindingAllowedAction = "pause" | "resume" | "run-now";
export type SourceBindingRunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "timeout"
  | "cancelled";

export type SourceBindingRunRef = {
  finished_at?: string | null;
  run_id: string;
  started_at?: string | null;
  status: SourceBindingRunStatus;
};

export type SourceBindingSummary = {
  allowed_actions: SourceBindingAllowedAction[];
  blocked_reason?: string | null;
  health_summary: Record<string, unknown>;
  id: string;
  last_run_ref?: SourceBindingRunRef | null;
  next_run_at?: string | null;
  owner_id: string;
  owner_type: string;
  schedule_summary: Record<string, unknown>;
  source_plugin_id: string;
  status: SourceBindingStatus;
};

export type SourceBindingListResponse = {
  items: SourceBindingSummary[];
  next_cursor?: string | null;
};

export type SourceBindingListParams = {
  limit?: number;
  ownerId?: string;
  ownerType?: string;
  sourcePluginId?: string;
  status?: SourceBindingStatus;
};

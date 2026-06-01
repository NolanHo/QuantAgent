import type { ApiError } from "@/shared/api";

import type {
  PluginErrorSummary,
  SectionAvailability,
  SectionAvailabilityState,
} from "../api/plugin-detail.contracts";

const availabilityLabels: Record<SectionAvailabilityState, string> = {
  degraded: "已降级",
  forbidden: "权限不足",
  not_collected: "尚未采集",
  not_configured: "未配置",
  ready: "可用",
  unavailable: "暂不可用",
};

export function formatAvailability(availability?: SectionAvailability | null): string {
  if (!availability) {
    return "未知";
  }
  const label = availabilityLabels[availability.state] ?? availability.state;
  return availability.message ? `${label}：${availability.message}` : label;
}

export function formatOptional(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  if (typeof value === "boolean") {
    return value ? "是" : "否";
  }
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return JSON.stringify(value);
}

export function formatErrorSummary(error?: PluginErrorSummary | null): string {
  if (!error) {
    return "无";
  }
  return `${error.code} / ${error.stage}：${error.message}`;
}

export function formatApiError(error: unknown): string {
  const candidate = error as Partial<ApiError> | null;
  const requestId = candidate?.requestId ? ` request_id=${candidate.requestId}` : "";
  const status = candidate?.status ? `HTTP ${candidate.status}` : "请求失败";
  const message = candidate?.msg ?? (error instanceof Error ? error.message : "未知错误");
  return `${status}：${message}${requestId}`;
}

export function formatDateTime(value?: string | null): string {
  if (!value) {
    return "-";
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }
  return new Date(timestamp).toLocaleString();
}

export function formatRecordSummary(value: Record<string, unknown>): string {
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return "-";
  }
  return entries.map(([key, item]) => `${key}: ${formatOptional(item)}`).join(" · ");
}

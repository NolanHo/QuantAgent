import {
  formatDateTime,
  formatOptional,
  formatRecordSummary,
} from "../../detail/utils/plugin-detail-format";
import type { SourceBindingSummary } from "../api/source-bindings.contracts";

export function summarizeBindingScope(binding: SourceBindingSummary): string {
  const schedule = formatRecordSummary(binding.schedule_summary);
  const health = formatRecordSummary(binding.health_summary);
  return `调度：${schedule} · 健康：${health}`;
}

export function summarizeLastRun(binding: SourceBindingSummary): string {
  if (!binding.last_run_ref) {
    return "暂无调度记录";
  }
  return `${binding.last_run_ref.status} · ${formatDateTime(binding.last_run_ref.started_at)}`;
}

export function summarizeBindingActivity(binding: SourceBindingSummary): string {
  return [
    `最近运行：${summarizeLastRun(binding)}`,
    `下次运行：${formatDateTime(binding.next_run_at)}`,
    `阻塞原因：${formatOptional(binding.blocked_reason)}`,
  ].join(" · ");
}

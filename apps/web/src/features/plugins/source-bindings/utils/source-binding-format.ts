import {
  formatDateTime,
  formatOptional,
  formatRecordSummary,
} from "../../detail/utils/plugin-detail-format";
import type { SourceBindingSummary } from "../api/source-bindings.contracts";

export function summarizeBindingScope(binding: SourceBindingSummary): string {
  const schedule = formatRecordSummary(binding.schedule_summary);
  const health = formatRecordSummary(binding.health_summary);
  return `schedule: ${schedule} · health: ${health}`;
}

export function summarizeLastRun(binding: SourceBindingSummary): string {
  if (!binding.last_run_ref) {
    return "暂无调度记录";
  }
  return `${binding.last_run_ref.status} · ${formatDateTime(binding.last_run_ref.started_at)}`;
}

export function summarizeBindingActivity(binding: SourceBindingSummary): string {
  return [
    `last_run=${summarizeLastRun(binding)}`,
    `next_run=${formatDateTime(binding.next_run_at)}`,
    `blocked=${formatOptional(binding.blocked_reason)}`,
  ].join(" · ");
}

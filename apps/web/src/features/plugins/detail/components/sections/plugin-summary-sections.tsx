import { Chip } from "@heroui/react";

import type { PluginDetailResponse } from "../../api/plugin-detail.contracts";
import {
  formatAvailability,
  formatDateTime,
  formatErrorSummary,
  formatOptional,
  formatRecordSummary,
} from "../../utils/plugin-detail-format";
import { DetailSectionCard } from "./detail-section-card";
import { KeyValueGrid } from "./key-value-grid";

export function PluginConfigDependencySection({ detail }: { detail: PluginDetailResponse }) {
  return (
    <DetailSectionCard
      description="配置和依赖保持只读摘要；保存、validate 与审计语义不在本轮实现。"
      eyebrow="Config / Dependencies"
      title="配置状态与依赖阻塞"
    >
      <KeyValueGrid
        rows={[
          { label: "config", value: formatAvailability(detail.config_summary.availability) },
          { label: "config_state", value: detail.config_summary.config_state },
          {
            label: "missing_required",
            value: String(detail.config_summary.missing_required_count),
          },
          {
            label: "masked_sensitive",
            value: String(detail.config_summary.masked_sensitive_count),
          },
          {
            label: "dependencies",
            value: formatAvailability(detail.dependency_summary.availability),
          },
          { label: "missing_dependencies", value: String(detail.dependency_summary.missing_count) },
          {
            label: "reverse_dependencies",
            value: String(detail.dependency_summary.reverse_dependency_count),
          },
          {
            label: "dependency_blocker",
            value: formatOptional(detail.dependency_summary.blocked_reason_summary),
          },
        ]}
      />
    </DetailSectionCard>
  );
}

export function PluginCapabilitiesSection({ detail }: { detail: PluginDetailResponse }) {
  return (
    <DetailSectionCard
      description="Skill、Tool、MarketMapping 只作为插件提供能力展示，不新增顶层管理对象。"
      eyebrow="Provided Capabilities"
      title="能力声明与治理提示"
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <Chip
            color={detail.capabilities.requires_approval ? "warning" : "default"}
            size="sm"
            variant="soft"
          >
            risk={detail.capabilities.risk_level_summary}
          </Chip>
          <Chip size="sm" variant="soft">
            policy_gate={detail.capabilities.requires_policy_gate ? "yes" : "no"}
          </Chip>
          <Chip size="sm" variant="soft">
            approval={detail.capabilities.requires_approval ? "yes" : "no"}
          </Chip>
        </div>
        <div className="grid gap-2">
          {detail.capabilities.declared_capabilities.length === 0 ? (
            <p className="m-0 rounded-lg border border-hairline bg-surface-soft px-3 py-3 text-body-sm text-muted">
              暂无能力声明。
            </p>
          ) : (
            detail.capabilities.declared_capabilities.map((capability) => (
              <div
                key={`${capability.kind}:${capability.name}`}
                className="rounded-lg border border-hairline bg-surface-soft px-3 py-3"
              >
                <p className="m-0 text-body-sm font-bold text-ink">{capability.name}</p>
                <p className="m-0 mt-1 text-body-sm text-muted">
                  kind={capability.kind} · risk={capability.risk_level} · availability=
                  {capability.availability_state}
                </p>
              </div>
            ))
          )}
        </div>
        <p className="m-0 text-body-sm text-muted">
          provided_objects_summary:{" "}
          {formatRecordSummary(detail.capabilities.provided_objects_summary)}
        </p>
      </div>
    </DetailSectionCard>
  );
}

export function PluginHealthAuditOpsSection({ detail }: { detail: PluginDetailResponse }) {
  return (
    <DetailSectionCard
      description="健康是插件中心摘要，不替代 runtime inspect；动作 hint 只表示展示语义，不等于 mutation 已实现。"
      eyebrow="Health / Audit / Ops"
      title="运行状态、审计摘要与动作边界"
    >
      <div className="grid gap-4">
        <KeyValueGrid
          rows={[
            {
              label: "health",
              value: `${detail.health_summary.status} · ${formatAvailability(detail.health_summary.availability)}`,
            },
            { label: "last_check_at", value: formatDateTime(detail.health_summary.last_check_at) },
            {
              label: "runtime_errors",
              value: String(detail.health_summary.recent_runtime_error_count),
            },
            {
              label: "health_error",
              value: formatErrorSummary(detail.health_summary.last_error_summary),
            },
            { label: "audit", value: formatAvailability(detail.audit_summary.availability) },
            { label: "last_actor", value: formatOptional(detail.audit_summary.last_actor) },
            {
              label: "last_changed_at",
              value: formatDateTime(detail.audit_summary.last_changed_at),
            },
            { label: "operable_state", value: detail.ops_summary.operable_state },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          {detail.allowed_actions.map((action) => (
            <Chip
              key={action.action}
              color={action.allowed ? "success" : "default"}
              size="sm"
              variant="soft"
            >
              {action.action}: {action.allowed ? "allowed" : (action.disabled_reason ?? "disabled")}
            </Chip>
          ))}
        </div>
        {detail.overview.type === "broker" ? (
          <p className="m-0 rounded-lg border border-warning/30 bg-warning/10 px-3 py-3 text-body-sm text-warning">
            Broker V1 只展示 disabled / dry_run / mock 边界，不暗示 live trading 已支持。
          </p>
        ) : null}
      </div>
    </DetailSectionCard>
  );
}

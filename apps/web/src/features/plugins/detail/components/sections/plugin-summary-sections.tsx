import { Chip } from "@heroui/react";

import type { PluginDetailResponse } from "../../api/plugin-detail.contracts";
import {
  formatAvailability,
  formatAction,
  formatConfigState,
  formatDateTime,
  formatErrorSummary,
  formatHealthStatus,
  formatKeyLabel,
  formatOptional,
  formatRecordSummary,
  formatRiskLevel,
  formatYesNo,
} from "../../utils/plugin-detail-format";
import { DetailSectionCard } from "./detail-section-card";
import { KeyValueGrid } from "./key-value-grid";

export function PluginConfigDependencySection({ detail }: { detail: PluginDetailResponse }) {
  return (
    <DetailSectionCard
      description="展示当前配置状态和依赖阻塞摘要；配置编辑请切换到配置页签。"
      eyebrow="配置 / 依赖"
      title="配置状态与依赖阻塞"
    >
      <KeyValueGrid
        rows={[
          { label: formatKeyLabel("config"), value: formatAvailability(detail.config_summary.availability) },
          { label: formatKeyLabel("config_state"), value: formatConfigState(detail.config_summary.config_state) },
          {
            label: formatKeyLabel("missing_required"),
            value: String(detail.config_summary.missing_required_count),
          },
          {
            label: formatKeyLabel("masked_sensitive"),
            value: String(detail.config_summary.masked_sensitive_count),
          },
          {
            label: formatKeyLabel("dependencies"),
            value: formatAvailability(detail.dependency_summary.availability),
          },
          { label: formatKeyLabel("missing_dependencies"), value: String(detail.dependency_summary.missing_count) },
          {
            label: formatKeyLabel("reverse_dependencies"),
            value: String(detail.dependency_summary.reverse_dependency_count),
          },
          {
            label: formatKeyLabel("dependency_blocker"),
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
      eyebrow="能力声明"
      title="能力声明与治理提示"
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <Chip
            color={detail.capabilities.requires_approval ? "warning" : "default"}
            size="sm"
            variant="soft"
          >
            风险：{formatRiskLevel(detail.capabilities.risk_level_summary)}
          </Chip>
          <Chip size="sm" variant="soft">
            策略门禁：{formatYesNo(detail.capabilities.requires_policy_gate)}
          </Chip>
          <Chip size="sm" variant="soft">
            需要审批：{formatYesNo(detail.capabilities.requires_approval)}
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
                  类型：{capability.kind} · 风险：{formatRiskLevel(capability.risk_level)} · 可用性：
                  {formatAvailability({ state: capability.availability_state })}
                </p>
              </div>
            ))
          )}
        </div>
        <p className="m-0 text-body-sm text-muted">
          提供对象摘要：
          {formatRecordSummary(detail.capabilities.provided_objects_summary)}
        </p>
      </div>
    </DetailSectionCard>
  );
}

export function PluginHealthAuditOpsSection({ detail }: { detail: PluginDetailResponse }) {
  return (
    <DetailSectionCard
      description="健康是插件中心摘要，不替代运行时诊断；动作提示只表示展示语义，不等于动作已实现。"
      eyebrow="健康 / 审计 / 操作"
      title="运行状态、审计摘要与动作边界"
    >
      <div className="grid gap-4">
        <KeyValueGrid
          rows={[
            {
              label: formatKeyLabel("health"),
              value: `${formatHealthStatus(detail.health_summary.status)} · ${formatAvailability(detail.health_summary.availability)}`,
            },
            { label: formatKeyLabel("last_check_at"), value: formatDateTime(detail.health_summary.last_check_at) },
            {
              label: formatKeyLabel("runtime_errors"),
              value: String(detail.health_summary.recent_runtime_error_count),
            },
            {
              label: formatKeyLabel("health_error"),
              value: formatErrorSummary(detail.health_summary.last_error_summary),
            },
            { label: formatKeyLabel("audit"), value: formatAvailability(detail.audit_summary.availability) },
            { label: formatKeyLabel("last_actor"), value: formatOptional(detail.audit_summary.last_actor) },
            {
              label: formatKeyLabel("last_changed_at"),
              value: formatDateTime(detail.audit_summary.last_changed_at),
            },
            { label: formatKeyLabel("operable_state"), value: formatOptional(detail.ops_summary.operable_state) },
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
              {formatAction(action.action)}：{action.allowed ? "可执行" : (action.disabled_reason ?? "不可执行")}
            </Chip>
          ))}
        </div>
        {detail.overview.type === "broker" ? (
          <p className="m-0 rounded-lg border border-warning/30 bg-warning/10 px-3 py-3 text-body-sm text-warning">
            Broker V1 只展示 disabled / dry_run / mock 边界，不暗示已支持真实交易。
          </p>
        ) : null}
      </div>
    </DetailSectionCard>
  );
}

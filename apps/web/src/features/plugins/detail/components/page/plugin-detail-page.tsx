import { Card, Chip } from "@heroui/react";

import {
  usePluginAuditViewQuery,
  usePluginDependenciesViewQuery,
  usePluginDetailQuery,
  usePluginHealthViewQuery,
} from "../../queries/use-plugin-detail";
import type { PluginDetailResponse } from "../../api/plugin-detail.contracts";
import {
  formatApiError,
  formatConfigState,
  formatKeyLabel,
  formatOptional,
  formatPluginStatus,
  formatPluginType,
} from "../../utils/plugin-detail-format";
import {
  PluginDetailEmptyState,
  PluginDetailErrorState,
  PluginDetailLoadingState,
} from "../states/plugin-detail-state";
import { PluginDetailWorkspace } from "./plugin-detail-workspace";

export function PluginDetailPage({ pluginId }: { pluginId: string }) {
  const detailQuery = usePluginDetailQuery(pluginId);
  const dependenciesQuery = usePluginDependenciesViewQuery(pluginId);
  const healthQuery = usePluginHealthViewQuery(pluginId);
  const auditQuery = usePluginAuditViewQuery(pluginId);

  if (detailQuery.isLoading) {
    return <PluginDetailLoadingState />;
  }

  if (detailQuery.isError) {
    return <PluginDetailErrorState message={formatApiError(detailQuery.error)} />;
  }

  if (!detailQuery.data) {
    return <PluginDetailEmptyState pluginId={pluginId} />;
  }

  const detail = detailQuery.data;

  return (
    <div className="grid gap-5">
      <section className="page-header">
        <div className="min-w-0">
          <p className="page-kicker">插件详情</p>
          <h1 className="page-title">{detail.overview.name}</h1>
          <p className="page-description">
            {detail.overview.description ??
              "插件治理详情：配置、依赖、能力、健康、审计与操作边界。"}
          </p>
        </div>
      </section>

      <PluginDetailHero detail={detail} />

      <PluginDetailWorkspace
        auditError={auditQuery.isError ? auditQuery.error : undefined}
        auditView={auditQuery.data}
        dependenciesError={dependenciesQuery.isError ? dependenciesQuery.error : undefined}
        dependenciesView={dependenciesQuery.data}
        detail={detail}
        healthError={healthQuery.isError ? healthQuery.error : undefined}
        healthView={healthQuery.data}
      />
    </div>
  );
}

function PluginDetailHero({ detail }: { detail: PluginDetailResponse }) {
  const { overview } = detail;

  return (
    <Card className="border border-hairline bg-surface shadow-sm">
      <Card.Content className="grid gap-4 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Chip color="default" size="sm" variant="soft">
                {formatPluginType(overview.type)}
              </Chip>
              <Chip color={pluginStatusColor(overview.status)} size="sm" variant="soft">
                {formatPluginStatus(overview.status)}
              </Chip>
              <Chip color="default" size="sm" variant="soft">
                {overview.source}
              </Chip>
              {overview.active_config_state !== "valid" ? (
                <Chip color="warning" size="sm" variant="soft">
                  配置：{formatConfigState(overview.active_config_state)}
                </Chip>
              ) : null}
            </div>
            <p className="m-0 mt-3 break-all text-body-sm text-muted">{overview.plugin_id}</p>
          </div>
          <div className="grid gap-2 text-body-sm sm:grid-cols-3 xl:min-w-[32rem]">
            <HeroMetric label="安装版本" value={formatOptional(overview.installed_version)} />
            <HeroMetric label="运行版本" value={formatOptional(overview.active_version)} />
            <HeroMetric label="可操作状态" value={detail.ops_summary.operable_state} />
          </div>
        </div>

        <div className="grid gap-2 border-t border-hairline pt-3 text-body-sm text-muted md:grid-cols-2 xl:grid-cols-4">
          {Object.entries(detail.related_resources).map(([key, value]) => (
            <p key={key} className="m-0 min-w-0 truncate">
              {formatKeyLabel(key)}: <span className="font-semibold text-ink">{value}</span>
            </p>
          ))}
        </div>
      </Card.Content>
    </Card>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface-soft px-3 py-2">
      <p className="m-0 text-[11px] font-semibold text-muted">{label}</p>
      <p className="m-0 mt-1 truncate text-body-sm font-bold text-ink">{value}</p>
    </div>
  );
}

function pluginStatusColor(status: string) {
  if (status === "failed" || status === "invalid") {
    return "danger";
  }
  if (status === "enabled" || status === "valid" || status === "started") {
    return "success";
  }
  if (status === "disabled" || status === "stopped" || status === "discovered") {
    return "warning";
  }
  return "default";
}

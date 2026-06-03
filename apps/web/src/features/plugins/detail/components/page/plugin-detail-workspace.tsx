import { Card, Chip, Tabs } from "@heroui/react";

import { SourceBindingsPanel } from "../../../source-bindings/components/source-bindings-panel";
import { PluginConfigEditorPanel } from "../config/plugin-config-editor-panel";
import type {
  PluginAuditViewResponse,
  PluginDependenciesViewResponse,
  PluginDetailResponse,
  PluginHealthViewResponse,
} from "../../api/plugin-detail.contracts";
import { formatApiError, formatAvailability } from "../../utils/plugin-detail-format";
import { PluginOverviewSection } from "../sections/plugin-overview-section";
import {
  PluginCapabilitiesSection,
  PluginConfigDependencySection,
  PluginHealthAuditOpsSection,
} from "../sections/plugin-summary-sections";

type PluginDetailWorkspaceProps = {
  auditError?: unknown;
  auditView?: PluginAuditViewResponse;
  dependenciesError?: unknown;
  dependenciesView?: PluginDependenciesViewResponse;
  detail: PluginDetailResponse;
  healthError?: unknown;
  healthView?: PluginHealthViewResponse;
};

export function PluginDetailWorkspace({
  auditError,
  auditView,
  dependenciesError,
  dependenciesView,
  detail,
  healthError,
  healthView,
}: PluginDetailWorkspaceProps) {
  return (
    <Card className="overflow-visible border border-hairline bg-surface shadow-sm">
      <Card.Content className="overflow-visible p-0">
        <Tabs defaultSelectedKey="overview" className="w-full">
          <Tabs.ListContainer className="border-b border-hairline px-3 py-2">
            <Tabs.List aria-label="插件详情视图" className="grid w-full grid-cols-5 gap-2">
              <Tabs.Tab id="overview" className="h-9 min-w-0 justify-center py-0">
                概览
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="config" className="h-9 min-w-0 justify-center py-0">
                配置
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="bindings" className="h-9 min-w-0 justify-center py-0">
                绑定
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="capabilities" className="h-9 min-w-0 justify-center py-0">
                依赖
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="health" className="h-9 min-w-0 justify-center py-0">
                健康
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>

          <div className="p-4">
            <Tabs.Panel id="overview" className="min-w-0">
              <PluginOverviewSection detail={detail} />
            </Tabs.Panel>

            <Tabs.Panel id="config" className="min-w-0">
              <PluginConfigEditorPanel pluginId={detail.overview.plugin_id} />
            </Tabs.Panel>

            <Tabs.Panel id="bindings" className="min-w-0">
              <SourceBindingsPanel overview={detail.overview} />
            </Tabs.Panel>

            <Tabs.Panel id="capabilities" className="min-w-0">
              <div className="grid gap-4 xl:grid-cols-2">
                <PluginConfigDependencySection detail={detail} />
                <PluginCapabilitiesSection detail={detail} />
              </div>
              <PluginSectionStatusPanel
                className="mt-4"
                rows={[
                  {
                    label: "依赖视图",
                    value: dependenciesView
                      ? formatAvailability(dependenciesView.availability)
                      : dependenciesError
                        ? formatApiError(dependenciesError)
                        : "加载中",
                  },
                  {
                    label: "插件依赖",
                    value: dependenciesView
                      ? String(dependenciesView.plugin_dependencies.length)
                      : "-",
                  },
                  {
                    label: "Python 依赖",
                    value: dependenciesView
                      ? String(dependenciesView.python_dependencies.length)
                      : "-",
                  },
                  {
                    label: "反向依赖",
                    value: dependenciesView
                      ? String(dependenciesView.reverse_dependencies.length)
                      : "-",
                  },
                ]}
                title="依赖子资源"
              />
            </Tabs.Panel>

            <Tabs.Panel id="health" className="min-w-0">
              <PluginHealthAuditOpsSection detail={detail} />
              <PluginSectionStatusPanel
                className="mt-4"
                rows={[
                  {
                    label: "健康视图",
                    value: healthView
                      ? formatAvailability(healthView.availability)
                      : healthError
                        ? formatApiError(healthError)
                        : "加载中",
                  },
                  {
                    label: "审计视图",
                    value: auditView
                      ? formatAvailability(auditView.availability)
                      : auditError
                        ? formatApiError(auditError)
                        : "加载中",
                  },
                  {
                    label: "运行错误",
                    value: healthView ? String(healthView.recent_runtime_error_count) : "-",
                  },
                  {
                    label: "审计记录",
                    value: auditView ? String(auditView.entries.length) : "-",
                  },
                ]}
                title="健康与审计子资源"
              />
            </Tabs.Panel>
          </div>
        </Tabs>
      </Card.Content>
    </Card>
  );
}

type PluginSectionStatusPanelProps = {
  className?: string;
  rows: Array<{ label: string; value: string }>;
  title: string;
};

function PluginSectionStatusPanel({ className = "", rows, title }: PluginSectionStatusPanelProps) {
  return (
    <section
      className={[
        "rounded-lg border border-hairline bg-surface-soft p-4",
        className,
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-title-sm font-bold text-ink">{title}</p>
        <Chip color="default" size="sm" variant="soft">
          只读
        </Chip>
      </div>
      <div className="mt-3 grid gap-2">
        {rows.map((row) => (
          <p key={row.label} className="m-0 flex min-w-0 justify-between gap-3 text-body-sm">
            <span className="shrink-0 text-muted">{row.label}</span>
            <span className="min-w-0 truncate text-right font-semibold text-ink">{row.value}</span>
          </p>
        ))}
      </div>
    </section>
  );
}

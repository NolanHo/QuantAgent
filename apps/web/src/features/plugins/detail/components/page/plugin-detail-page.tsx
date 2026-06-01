import { LinkButton } from "@/shared/ui";

import { SourceBindingsPanel } from "../../../source-bindings/components/source-bindings-panel";
import {
  usePluginAuditViewQuery,
  usePluginConfigViewQuery,
  usePluginDependenciesViewQuery,
  usePluginDetailQuery,
  usePluginHealthViewQuery,
} from "../../queries/use-plugin-detail";
import { formatApiError, formatAvailability } from "../../utils/plugin-detail-format";
import { PluginOverviewSection } from "../sections/plugin-overview-section";
import {
  PluginCapabilitiesSection,
  PluginConfigDependencySection,
  PluginHealthAuditOpsSection,
} from "../sections/plugin-summary-sections";
import {
  PluginDetailEmptyState,
  PluginDetailErrorState,
  PluginDetailLoadingState,
} from "../states/plugin-detail-state";

export function PluginDetailPage({ pluginId }: { pluginId: string }) {
  const detailQuery = usePluginDetailQuery(pluginId);
  const configQuery = usePluginConfigViewQuery(pluginId);
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="page-kicker">Plugin Detail</p>
            <h1 className="page-title">{detail.overview.name}</h1>
            <p className="page-description">
              {detail.overview.description ??
                "只读插件治理骨架：Overview、Config、Dependencies、Capabilities、Health、Audit 与 Ops。"}
            </p>
          </div>
          <LinkButton to="/plugins" variant="outline">
            返回插件列表
          </LinkButton>
        </div>
      </section>

      <PluginOverviewSection detail={detail} />

      <section className="grid gap-4 xl:grid-cols-2">
        <PluginConfigDependencySection detail={detail} />
        <PluginCapabilitiesSection detail={detail} />
      </section>

      <SourceBindingsPanel overview={detail.overview} />

      <PluginHealthAuditOpsSection detail={detail} />

      <section className="rounded-xl border border-hairline bg-surface-soft p-4">
        <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          Related resources
        </p>
        <div className="mt-3 grid gap-2 text-body-sm text-muted sm:grid-cols-2">
          {Object.entries(detail.related_resources).map(([key, value]) => (
            <p key={key} className="m-0">
              {key}: <span className="font-semibold text-ink">{value}</span>
            </p>
          ))}
        </div>
        <p className="m-0 mt-3 text-body-sm text-muted">
          子资源状态： config=
          {configQuery.data
            ? formatAvailability(configQuery.data.availability)
            : configQuery.isError
              ? formatApiError(configQuery.error)
              : "加载中"}
          ； dependencies=
          {dependenciesQuery.data
            ? formatAvailability(dependenciesQuery.data.availability)
            : dependenciesQuery.isError
              ? formatApiError(dependenciesQuery.error)
              : "加载中"}
          ； health=
          {healthQuery.data
            ? formatAvailability(healthQuery.data.availability)
            : healthQuery.isError
              ? formatApiError(healthQuery.error)
              : "加载中"}
          ； audit=
          {auditQuery.data
            ? formatAvailability(auditQuery.data.availability)
            : auditQuery.isError
              ? formatApiError(auditQuery.error)
              : "加载中"}
        </p>
      </section>
    </div>
  );
}

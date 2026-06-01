import { Chip, Spinner } from "@heroui/react";

import { LinkButton } from "@/shared/ui";

import { usePluginListQuery } from "../../queries/use-plugin-detail";
import {
  formatApiError,
  formatErrorSummary,
  formatOptional,
} from "../../utils/plugin-detail-format";

export function PluginsIndexPage() {
  const pluginListQuery = usePluginListQuery();
  const plugins = pluginListQuery.data ?? [];

  return (
    <div className="grid gap-5">
      <section className="page-header">
        <p className="page-kicker">Registry / Plugins</p>
        <h1 className="page-title">插件治理</h1>
        <p className="page-description">
          统一管理 source、industry、strategy、notification、broker
          五类插件；列表页只负责入口、筛选视角和详情跳转。
        </p>
      </section>

      {pluginListQuery.isLoading ? (
        <div className="flex min-h-40 items-center justify-center rounded-xl border border-hairline bg-surface">
          <Spinner size="md" />
          <span className="ml-3 text-body-sm text-muted">正在加载插件列表...</span>
        </div>
      ) : null}

      {pluginListQuery.isError ? (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-body-sm text-warning">
          插件列表接口暂不可用：{formatApiError(pluginListQuery.error)}
        </div>
      ) : null}

      {!pluginListQuery.isLoading && !pluginListQuery.isError && plugins.length === 0 ? (
        <div className="rounded-xl border border-hairline bg-surface p-5">
          <p className="m-0 text-title-sm font-bold text-ink">Registry 当前没有插件记录</p>
          <p className="m-0 mt-2 text-body-sm text-muted">
            请确认后端 Registry 已扫描官方插件目录和 runtime/plugins。
          </p>
        </div>
      ) : null}

      {plugins.length > 0 ? (
        <section className="grid gap-3">
          {plugins.map((plugin) => {
            const manifest = plugin.manifest;
            return (
              <article
                key={plugin.id}
                className="grid gap-3 rounded-xl border border-hairline bg-surface p-4"
              >
                <div className="flex flex-wrap gap-2">
                  <Chip size="sm" variant="soft">
                    {manifest?.type ?? "unknown"}
                  </Chip>
                  <Chip size="sm" variant="soft">
                    {plugin.status}
                  </Chip>
                  <Chip size="sm" variant="soft">
                    {plugin.source}
                  </Chip>
                </div>
                <div className="grid gap-1">
                  <h2 className="m-0 text-title-sm font-bold text-ink">
                    {manifest?.name ?? plugin.id}
                  </h2>
                  <p className="m-0 text-body-sm text-muted">
                    plugin_id: {plugin.id} · installed_version: {formatOptional(manifest?.version)}
                  </p>
                  <p className="m-0 text-body-sm text-muted">
                    {manifest?.description ?? "manifest 暂不可用，详情页会展示受控失败态。"}
                  </p>
                  <p className="m-0 text-body-sm text-muted">
                    last_error: {formatErrorSummary(plugin.last_error)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <LinkButton to="/plugins/$pluginId" params={{ pluginId: plugin.id }}>
                    查看插件详情
                  </LinkButton>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}

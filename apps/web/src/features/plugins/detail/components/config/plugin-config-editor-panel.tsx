import { Chip, Spinner, Surface, Table } from "@heroui/react";

import { usePluginConfigViewQuery } from "../../queries/use-plugin-detail";
import type { PluginConfigEntry } from "../../api/plugin-detail.contracts";
import {
  formatApiError,
  formatAvailability,
  formatConfigState,
  formatDateTime,
  formatOptional,
} from "../../utils/plugin-detail-format";
import { KeyValueGrid, type KeyValueRow } from "../sections/key-value-grid";

type PluginConfigViewPanelProps = {
  pluginId: string;
};

export function PluginConfigViewPanel({ pluginId }: PluginConfigViewPanelProps) {
  const configQuery = usePluginConfigViewQuery(pluginId);
  const configView = configQuery.data ?? null;

  if (configQuery.isLoading) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-lg border border-hairline bg-surface">
        <Spinner size="md" />
        <span className="ml-3 text-body-sm text-muted">正在加载插件配置视图...</span>
      </div>
    );
  }

  if (configQuery.isError) {
    return (
      <Surface className="rounded-lg border border-warning/30" variant="secondary">
        <div className="p-4">
          <p className="m-0 text-title-sm font-bold text-warning">插件配置加载失败</p>
          <p className="m-0 mt-2 text-body-sm text-warning">{formatApiError(configQuery.error)}</p>
        </div>
      </Surface>
    );
  }

  if (!configView) {
    return (
      <Surface className="rounded-lg" variant="secondary">
        <div className="p-4">
          <p className="m-0 text-body-sm text-muted">当前插件没有可展示的配置视图。</p>
        </div>
      </Surface>
    );
  }

  const summaryRows: KeyValueRow[] = [
    { label: "可见性", value: formatAvailability(configView.availability) },
    { label: "配置状态", value: formatConfigState(configView.config_state) },
    { label: "Schema", value: formatOptional(configView.schema?.title ?? configView.schema?.schema_ref) },
    { label: "Schema 版本", value: formatOptional(configView.schema?.schema_version) },
    { label: "最近校验", value: formatDateTime(configView.last_validated_at) },
    { label: "最近更新", value: formatDateTime(configView.last_updated_at) },
    { label: "需要重载", value: configView.reload_required ? "是" : "否" },
    { label: "字段数量", value: String(configView.entries.length) },
  ];

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="m-0 text-title-sm font-bold text-ink">配置视图</p>
            <Chip color={configView.availability.state === "ready" ? "success" : "warning"} size="sm" variant="soft">
              {formatAvailability(configView.availability)}
            </Chip>
          </div>
          <p className="m-0 mt-1 text-body-sm text-muted">
            展示当前可见配置字段、脱敏状态、最近校验信息和重载要求。
          </p>
        </div>
        <Chip color={configView.reload_required ? "warning" : "default"} size="sm" variant="soft">
          {configView.reload_required ? "保存后需重载" : "无需重载"}
        </Chip>
      </div>

      <KeyValueGrid rows={summaryRows} />

      {configView.entries.length === 0 ? (
        <p className="m-0 rounded-lg border border-hairline bg-surface-soft px-3 py-4 text-body-sm text-muted">
          当前配置视图没有可展示字段，可能是未配置、权限不足或该插件暂不提供配置明细。
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-hairline">
          <Table aria-label="插件配置字段" variant="secondary">
            <Table.Content className="min-w-[48rem]">
              <Table.Header>
                <Table.Column>字段</Table.Column>
                <Table.Column>当前值</Table.Column>
                <Table.Column>展示方式</Table.Column>
                <Table.Column>属性</Table.Column>
              </Table.Header>
              <Table.Body items={configView.entries}>
                {(entry) => (
                  <Table.Row key={entry.key}>
                    <Table.Cell className="font-semibold text-ink">{entry.key}</Table.Cell>
                    <Table.Cell>{formatConfigEntryValue(entry)}</Table.Cell>
                    <Table.Cell>{formatConfigDisplayMode(entry.display_mode)}</Table.Cell>
                    <Table.Cell>{formatConfigEntryFlags(entry)}</Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table.Content>
          </Table>
        </div>
      )}
    </div>
  );
}

function formatConfigEntryValue(entry: PluginConfigEntry): string {
  if (entry.display_mode === "masked") {
    return entry.display_value ?? "已脱敏";
  }
  if (entry.display_mode === "unset") {
    return "未设置";
  }
  return formatOptional(entry.display_value);
}

function formatConfigDisplayMode(displayMode: PluginConfigEntry["display_mode"]): string {
  const labels: Record<PluginConfigEntry["display_mode"], string> = {
    masked: "掩码",
    plain: "明文摘要",
    reference: "引用",
    unset: "未设置",
  };

  return labels[displayMode] ?? displayMode;
}

function formatConfigEntryFlags(entry: PluginConfigEntry): string {
  const flags = [
    entry.is_required ? "必填" : "可选",
    entry.is_sensitive ? "敏感" : null,
    entry.is_overridden ? "已覆盖" : null,
  ].filter(Boolean);

  return flags.join(" / ") || "-";
}

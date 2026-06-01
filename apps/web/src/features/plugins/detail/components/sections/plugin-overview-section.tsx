import { Chip } from "@heroui/react";

import type { PluginDetailResponse } from "../../api/plugin-detail.contracts";
import {
  formatAvailability,
  formatErrorSummary,
  formatOptional,
} from "../../utils/plugin-detail-format";
import { DetailSectionCard } from "./detail-section-card";
import { KeyValueGrid } from "./key-value-grid";

export function PluginOverviewSection({ detail }: { detail: PluginDetailResponse }) {
  const { overview } = detail;

  return (
    <DetailSectionCard
      description="先判断插件是否可用，以及阻塞来自配置、依赖、权限还是运行错误。"
      eyebrow="Overview"
      title="插件治理摘要"
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <Chip size="sm" variant="soft">
            {overview.type}
          </Chip>
          <Chip size="sm" variant="soft">
            {overview.status}
          </Chip>
          <Chip size="sm" variant="soft">
            {overview.source}
          </Chip>
          {overview.active_config_state !== "valid" ? (
            <Chip color="warning" size="sm" variant="soft">
              config: {overview.active_config_state}
            </Chip>
          ) : null}
        </div>
        <KeyValueGrid
          rows={[
            { label: "plugin_id", value: overview.plugin_id },
            { label: "installed_version", value: formatOptional(overview.installed_version) },
            { label: "active_version", value: formatOptional(overview.active_version) },
            { label: "blocked_reason", value: formatOptional(overview.blocked_reason) },
            { label: "last_error", value: formatErrorSummary(overview.last_error_summary) },
            { label: "ops_state", value: formatAvailability(detail.ops_summary.availability) },
          ]}
        />
      </div>
    </DetailSectionCard>
  );
}

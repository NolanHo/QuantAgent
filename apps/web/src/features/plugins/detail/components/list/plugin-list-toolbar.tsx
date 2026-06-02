import { Button, Chip, Input } from "@heroui/react";

import type { PluginRecordResponse } from "../../../api/contracts";

type PluginListToolbarProps = {
  activeType: string;
  onRefresh: () => void;
  onSearchChange: (value: string) => void;
  onTypeChange: (type: string) => void;
  pluginCount: number;
  searchValue: string;
  types: string[];
};

export function PluginListToolbar({
  activeType,
  onRefresh,
  onSearchChange,
  onTypeChange,
  pluginCount,
  searchValue,
  types,
}: PluginListToolbarProps) {
  return (
    <section className="rounded-lg border border-hairline bg-surface p-3 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Button size="sm" type="button" variant="primary" onPress={onRefresh}>
            刷新
          </Button>
          <Chip color="default" size="sm" variant="soft">
            共 {pluginCount} 个插件
          </Chip>
        </div>
        <Input
          aria-label="搜索插件"
          className="w-full xl:max-w-80"
          onChange={(event) => {
            onSearchChange(event.target.value);
          }}
          placeholder="搜索名称、ID、描述"
          type="search"
          value={searchValue}
          variant="secondary"
        />
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {types.map((type) => (
          <Button
            key={type}
            className="shrink-0"
            size="sm"
            type="button"
            variant={activeType === type ? "primary" : "secondary"}
            onPress={() => {
              onTypeChange(type);
            }}
          >
            {type === "all" ? "全部" : type}
          </Button>
        ))}
      </div>
    </section>
  );
}

export function collectPluginTypes(plugins: PluginRecordResponse[]) {
  const typeSet = new Set<string>();

  for (const plugin of plugins) {
    typeSet.add(plugin.manifest?.type ?? "unknown");
  }

  return ["all", ...Array.from(typeSet).sort()];
}

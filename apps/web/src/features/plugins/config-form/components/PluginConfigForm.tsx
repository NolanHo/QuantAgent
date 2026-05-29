import { useEffect, useMemo, useRef, useState } from "react";
import { Card, Fieldset, Form, Tabs } from "@heroui/react";

import {
  parseConfigDraftPayload,
  PluginConfigJsonFieldParseError,
} from "../lib/model";
import type {
  PluginConfigFieldDefinition,
  PluginConfigSchemaSnapshot,
} from "../types";
import { PluginConfigField } from "./PluginConfigField";
import { PluginConfigSupportMatrix } from "./PluginConfigSupportMatrix";

type PluginConfigFormProps = {
  issueLookup: Map<string, string>;
  onValueChange: (path: string, nextValue: string) => void;
  schema: PluginConfigSchemaSnapshot;
  showSupportMatrix?: boolean;
  values: Record<string, string>;
};

export function PluginConfigForm({
  issueLookup,
  onValueChange,
  schema,
  showSupportMatrix = true,
  values,
}: PluginConfigFormProps) {
  const formViewportRef = useRef<HTMLDivElement | null>(null);
  const fieldGroups = useMemo(
    () => groupFields(schema.fields),
    [schema.fields],
  );
  const defaultSelectedGroupKey = fieldGroups[0]?.key ?? null;
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(
    defaultSelectedGroupKey,
  );
  const [isCompactLayout, setIsCompactLayout] = useState(false);
  const selectedGroup =
    fieldGroups.find((group) => group.key === selectedGroupKey) ??
    fieldGroups[0] ??
    null;

  useEffect(() => {
    setSelectedGroupKey(defaultSelectedGroupKey);
  }, [schema.pluginId, fieldGroups, defaultSelectedGroupKey]);

  useEffect(() => {
    const viewport = formViewportRef.current;

    if (!viewport || typeof ResizeObserver === "undefined") {
      return;
    }

    // 只在跨过紧凑布局阈值时触发 React 更新，避免抽屉拖拽时整棵表单逐帧重渲染。
    const updateLayoutMode = (width: number) => {
      setIsCompactLayout((current) => {
        const next = width < 860;
        return current === next ? current : next;
      });
    };

    updateLayoutMode(viewport.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => {
      updateLayoutMode(entry.contentRect.width);
    });

    observer.observe(viewport);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={formViewportRef} className="w-full">
      <Form className="grid w-full gap-4">
        <Card className="overflow-visible">
          <Card.Content className="overflow-visible">
            <Tabs
              className="w-full"
              orientation={isCompactLayout ? "horizontal" : "vertical"}
              selectedKey={selectedGroupKey ?? undefined}
              onSelectionChange={(key) => {
                setSelectedGroupKey(String(key));
              }}
            >
              <div
                className={
                  isCompactLayout
                    ? "grid gap-4"
                    : "grid w-full items-start grid-cols-[180px_minmax(0,1fr)] gap-4"
                }
              >
                <div
                  className={
                    isCompactLayout
                      ? "w-full overflow-x-auto"
                      : "sticky top-4 self-start"
                  }
                >
                  <Tabs.ListContainer>
                    <Tabs.List
                      aria-label="配置分类"
                      className={
                        isCompactLayout
                          ? "flex w-max min-w-full gap-1"
                          : "grid w-full gap-1"
                      }
                    >
                      {fieldGroups.map((group) => (
                        <Tabs.Tab
                          key={group.key}
                          id={group.key}
                          className={[
                            "h-auto min-h-0 items-center py-2.5",
                            isCompactLayout ? "min-w-[152px]" : "",
                          ].join(" ")}
                        >
                          <span className="text-left text-[15px] font-semibold leading-5">
                            {group.title}
                          </span>
                          <Tabs.Indicator />
                        </Tabs.Tab>
                      ))}
                    </Tabs.List>
                  </Tabs.ListContainer>
                </div>

                {/* 只挂载当前分组，避免大 schema 的隐藏字段参与滚动期重渲染。 */}
                {selectedGroup ? (
                  <Tabs.Panel
                    id={selectedGroup.key}
                    className={isCompactLayout ? "min-w-0 pt-0" : "min-w-0 pr-1"}
                  >
                    <SelectedGroupPanel
                      group={selectedGroup}
                      isCompactLayout={isCompactLayout}
                      issueLookup={issueLookup}
                      onValueChange={onValueChange}
                      values={values}
                    />
                  </Tabs.Panel>
                ) : null}
              </div>
            </Tabs>
          </Card.Content>
        </Card>

        {showSupportMatrix ? (
          <PluginConfigSupportMatrix supportMatrix={schema.supportMatrix} />
        ) : null}
      </Form>
    </div>
  );
}

type SelectedGroupPanelProps = {
  group: ReturnType<typeof groupFields>[number];
  isCompactLayout: boolean;
  issueLookup: Map<string, string>;
  onValueChange: (path: string, nextValue: string) => void;
  values: Record<string, string>;
};

function SelectedGroupPanel({
  group,
  isCompactLayout,
  issueLookup,
  onValueChange,
  values,
}: SelectedGroupPanelProps) {
  return (
    <section
      id={`plugin-group-${group.key}`}
      className="grid w-full gap-2.5 rounded-[20px] border border-slate-200 bg-white p-3 shadow-sm"
    >
      <Fieldset>
        <div className="grid gap-2 rounded-[20px] border border-slate-200 bg-slate-50/70 p-3">
          <Fieldset.Group className="grid gap-0 px-3">
            {group.fields.map((definition) => (
              <PluginConfigField
                key={definition.path}
                definition={definition}
                isCompactLayout={isCompactLayout}
                isInlineRow
                issue={issueLookup.get(definition.path)}
                onChange={onValueChange}
                value={values[definition.path] ?? ""}
              />
            ))}
          </Fieldset.Group>
        </div>
      </Fieldset>
    </section>
  );
}

export function buildPluginConfigPreviewPayload(
  schema: PluginConfigSchemaSnapshot,
  values: Record<string, string>,
) {
  try {
    return JSON.stringify(parseConfigDraftPayload(schema, values), null, 2);
  } catch (error) {
    if (error instanceof PluginConfigJsonFieldParseError) {
      return JSON.stringify(
        {
          error: `字段 ${error.path} 无法解析`,
        },
        null,
        2,
      );
    }

    return '{\n  "error": "存在无法解析的 JSON 字段"\n}';
  }
}

function groupFields(fields: PluginConfigFieldDefinition[]) {
  const groups = new Map<string, PluginConfigFieldDefinition[]>();

  for (const field of fields) {
    const groupKey = field.path.includes(".")
      ? field.path.split(".")[0]
      : "base";
    const current = groups.get(groupKey) ?? [];
    current.push(field);
    groups.set(groupKey, current);
  }

  return Array.from(groups.entries()).map(([key, groupFields]) => ({
    key,
    title: groupTitle(key),
    fields: groupFields,
  }));
}

function groupTitle(groupKey: string) {
  if (groupKey === "base") {
    return "基础信息";
  }

  const titleMap: Record<string, string> = {
    advancedMetrics: "高级监控",
    auth: "认证配置",
    deploymentZone: "部署配置",
    topology: "部署拓扑",
  };

  if (titleMap[groupKey]) {
    return titleMap[groupKey];
  }

  return groupKey
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (value) => value.toUpperCase());
}

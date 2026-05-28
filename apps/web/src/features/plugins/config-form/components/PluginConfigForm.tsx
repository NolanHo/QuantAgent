import { useEffect, useMemo, useState } from "react";
import { Card, Fieldset, Form, Tabs } from "@heroui/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

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

const MOTION_EASE = [0.22, 1, 0.36, 1] as const;

export type PluginConfigFormPluginOption = {
  id: string;
  name: string;
};

type PluginConfigFormProps = {
  containerWidth?: number;
  isSaving?: boolean;
  issueLookup: Map<string, string>;
  onValueChange: (path: string, nextValue: string) => void;
  plugins?: PluginConfigFormPluginOption[];
  schema: PluginConfigSchemaSnapshot;
  selectedPluginId?: string;
  showSupportMatrix?: boolean;
  values: Record<string, string>;
};

export function PluginConfigForm({
  containerWidth,
  issueLookup,
  onValueChange,
  plugins = [],
  schema,
  selectedPluginId,
  showSupportMatrix = true,
  values,
}: PluginConfigFormProps) {
  const prefersReducedMotion = useReducedMotion();
  const fieldGroups = useMemo(
    () => groupFields(schema.fields),
    [schema.fields],
  );
  const defaultSelectedGroupKey = fieldGroups[0]?.key ?? null;
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(
    defaultSelectedGroupKey,
  );
  const selectedPluginName =
    plugins.find((plugin) => plugin.id === selectedPluginId)?.name ??
    schema.pluginName;
  const isCompactLayout = (containerWidth ?? Number.POSITIVE_INFINITY) < 860;
  const panelTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.26, ease: MOTION_EASE };
  const selectedGroup =
    fieldGroups.find((group) => group.key === selectedGroupKey) ??
    fieldGroups[0] ??
    null;

  useEffect(() => {
    setSelectedGroupKey(defaultSelectedGroupKey);
  }, [schema.pluginId, fieldGroups, defaultSelectedGroupKey]);

  return (
    <Form className="grid w-full gap-4">
      <motion.div layout transition={panelTransition}>
        <Card className="overflow-visible">
          <Card.Header>
            <div className="grid gap-1">
              <Card.Title>配置表单</Card.Title>
              <Card.Description>{selectedPluginName} 配置</Card.Description>
            </div>
          </Card.Header>
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
                <div className={isCompactLayout ? "w-full overflow-x-auto" : "sticky top-4 self-start"}>
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
                            "h-auto min-h-16 items-start py-3",
                            isCompactLayout ? "min-w-[152px]" : "",
                          ].join(" ")}
                        >
                          <div className="grid gap-1 text-left leading-5">
                            <span className="text-[15px] font-semibold">
                              {group.title}
                            </span>
                            <span className="text-xs text-slate-500">
                              {group.summary}
                            </span>
                          </div>
                          <Tabs.Indicator />
                        </Tabs.Tab>
                      ))}
                    </Tabs.List>
                  </Tabs.ListContainer>
                </div>

                {/* Only mount the active group panel so large schemas don't re-render hidden fields. */}
                {selectedGroup ? (
                  <Tabs.Panel
                    id={selectedGroup.key}
                    className={isCompactLayout ? "min-w-0 pt-0" : "min-w-0 pr-1"}
                  >
                    <AnimatePresence initial={false} mode="wait">
                      <motion.div
                        key={`${selectedGroup.key}-${isCompactLayout ? "compact" : "wide"}`}
                        animate={{ opacity: 1, x: 0, y: 0 }}
                        exit={{
                          opacity: 0,
                          x: prefersReducedMotion ? 0 : -16,
                          y: prefersReducedMotion ? 0 : 8,
                        }}
                        initial={{
                          opacity: 0,
                          x: prefersReducedMotion ? 0 : 18,
                          y: prefersReducedMotion ? 0 : 8,
                        }}
                        transition={panelTransition}
                      >
                        <SelectedGroupPanel
                          group={selectedGroup}
                          isCompactLayout={isCompactLayout}
                          issueLookup={issueLookup}
                          onValueChange={onValueChange}
                          values={values}
                        />
                      </motion.div>
                    </AnimatePresence>
                  </Tabs.Panel>
                ) : null}
              </div>
            </Tabs>
          </Card.Content>
        </Card>
      </motion.div>

      {showSupportMatrix ? (
        <PluginConfigSupportMatrix supportMatrix={schema.supportMatrix} />
      ) : null}
    </Form>
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
      className="grid w-full gap-2.5 rounded-[20px] border border-white/60 bg-white/72 p-3 ring-1 ring-black/5 backdrop-blur"
    >
      <div className="grid gap-0.5 border-b border-black/5 pb-2.5 text-left">
        <p className="m-0 text-[15px] font-bold text-slate-900">
          {group.title}
        </p>
        <p className="m-0 text-xs text-slate-500">{group.summary}</p>
      </div>
      <Fieldset>
        <div className="grid gap-2 rounded-[20px] border border-white/50 bg-white/55 p-3 ring-1 ring-black/5 backdrop-blur">
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
    summary: groupSummary(groupFields),
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

function groupSummary(fields: PluginConfigFieldDefinition[]) {
  const requiredCount = fields.filter((field) => field.required).length;
  const editableCount = fields.filter((field) => !field.readOnly).length;
  const summary = [
    `${fields.length} 个字段`,
    `${requiredCount} 个必填`,
    `${editableCount} 个可编辑`,
  ];

  return summary.join(" / ");
}

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

type PluginConfigFormProps = {
  containerWidth?: number;
  issueLookup: Map<string, string>;
  onValueChange: (path: string, nextValue: string) => void;
  schema: PluginConfigSchemaSnapshot;
  showSupportMatrix?: boolean;
  values: Record<string, string>;
};

export function PluginConfigForm({
  containerWidth,
  issueLookup,
  onValueChange,
  schema,
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

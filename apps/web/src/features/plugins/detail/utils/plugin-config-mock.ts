import type {
  PluginConfigFieldDefinition,
  PluginConfigSaveResult,
  PluginConfigSchemaSnapshot,
  PluginConfigSnapshot,
  PluginConfigValidationResult,
  PluginConfigValueMap,
} from "@/features/plugins/config-form";
import {
  maskSensitiveValues,
  validateSchemaFields,
} from "@/features/plugins/config-form";

const MOCK_MASK_TOKEN = "********";
const MOCK_LATENCY_MS = 180;

const mockConfigStore = new Map<string, PluginConfigSnapshot>();

export async function loadMockPluginConfig(
  schema: PluginConfigSchemaSnapshot,
): Promise<PluginConfigSnapshot> {
  await delay(MOCK_LATENCY_MS);

  const existing = mockConfigStore.get(schema.pluginId);
  if (existing) {
    return existing;
  }

  const snapshot = createMockSnapshot(schema);
  mockConfigStore.set(schema.pluginId, snapshot);
  return snapshot;
}

export async function validateMockPluginConfig(
  schema: PluginConfigSchemaSnapshot,
  values: PluginConfigValueMap,
): Promise<PluginConfigValidationResult> {
  await delay(MOCK_LATENCY_MS);
  return validateSchemaFields(schema, values);
}

export async function saveMockPluginConfig(
  schema: PluginConfigSchemaSnapshot,
  values: PluginConfigValueMap,
): Promise<PluginConfigSaveResult> {
  await delay(MOCK_LATENCY_MS);

  const validation = validateSchemaFields(schema, values);
  if (!validation.ok) {
    throw new Error(validation.issues[0]?.message ?? "请先修正表单校验问题。");
  }

  const previous = mockConfigStore.get(schema.pluginId);
  const versionSeed = previous?.versionTag ?? "mock-v1";
  const nextSnapshot: PluginConfigSnapshot = {
    maskedPaths: schema.fields.filter((field) => field.sensitive).map((field) => field.path),
    // 中文注释：详情页 mock save 只模拟表单闭环，不伪装成真实 secret 回显。
    values: maskSensitiveValues(values, schema.fields, [], MOCK_MASK_TOKEN),
    versionTag: `${versionSeed}-saved`,
  };

  mockConfigStore.set(schema.pluginId, nextSnapshot);

  return {
    updatedAt: new Date().toISOString(),
    versionTag: nextSnapshot.versionTag,
  };
}

function createMockSnapshot(schema: PluginConfigSchemaSnapshot): PluginConfigSnapshot {
  const values: PluginConfigValueMap = {};

  for (const field of schema.fields) {
    values[field.path] = inferMockFieldValue(field, schema.pluginId);
  }

  return {
    maskedPaths: schema.fields.filter((field) => field.sensitive).map((field) => field.path),
    values,
    versionTag: "mock-v1",
  };
}

function inferMockFieldValue(
  field: PluginConfigFieldDefinition,
  pluginId: string,
): string {
  if (field.constValue !== undefined) {
    return stringifyFieldValue(field.constValue, field.type);
  }

  if (field.defaultValue !== undefined) {
    return stringifyFieldValue(field.defaultValue, field.type);
  }

  if (field.sensitive) {
    return MOCK_MASK_TOKEN;
  }

  if (field.enumValues?.length) {
    return field.enumValues[0] ?? "";
  }

  if (field.choiceOptions?.length) {
    return field.choiceOptions.slice(0, 2).join(",");
  }

  switch (field.type) {
    case "boolean":
      return field.required ? "true" : "";
    case "integer":
      return field.constraints?.minimum !== undefined
        ? String(Math.max(1, field.constraints.minimum))
        : "1";
    case "number":
      return field.constraints?.minimum !== undefined
        ? String(Math.max(0.5, field.constraints.minimum))
        : "0.5";
    case "array":
      return field.support === "degraded" ? "[]" : "sample-a,sample-b";
    case "record":
      return "{}";
    case "union":
      return field.unionOptions?.[0]
        ? JSON.stringify({ type: field.unionOptions[0] }, null, 2)
        : "{}";
    case "object":
      return "{}";
    case "string":
    default:
      return inferStringFieldValue(field, pluginId);
  }
}

function inferStringFieldValue(
  field: PluginConfigFieldDefinition,
  pluginId: string,
): string {
  if (field.constraints?.format === "uri" || field.constraints?.format === "url") {
    return `https://mock.quantagent.local/plugins/${pluginId}`;
  }

  if (field.constraints?.format === "uuid") {
    return "11111111-1111-4111-8111-111111111111";
  }

  if (field.constraints?.format === "date-time") {
    return "2026-06-03T12:00:00Z";
  }

  if (field.constraints?.format === "ipv4") {
    return "127.0.0.1";
  }

  const normalizedKey = field.key.toLowerCase();
  if (normalizedKey.includes("name")) {
    return `${pluginId.split(".").at(-1) ?? "plugin"}-mock`;
  }
  if (normalizedKey.includes("path")) {
    return `/runtime/mock/${pluginId}`;
  }
  if (normalizedKey.includes("endpoint") || normalizedKey.includes("url")) {
    return `https://mock.quantagent.local/${pluginId}`;
  }
  if (normalizedKey.includes("token")) {
    return "mock-token";
  }

  return field.required ? `${field.key}-mock` : "";
}

function stringifyFieldValue(value: unknown, fieldType: PluginConfigFieldDefinition["type"]): string {
  if (value === undefined || value === null) {
    return "";
  }

  if (fieldType === "boolean") {
    return value ? "true" : "false";
  }

  if (fieldType === "array") {
    return Array.isArray(value) ? value.map((item) => String(item)).join(",") : String(value);
  }

  if (fieldType === "record" || fieldType === "union" || fieldType === "object") {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

import type {
  PluginConfigSnapshotResponse,
  PluginConfigUpdateResponse,
  PluginConfigValidateResponse,
} from "../../api/contracts";
import type {
  PluginConfigJsonSchema,
  PluginConfigSaveResult,
  PluginConfigSchemaSnapshot,
  PluginConfigSnapshot,
  PluginConfigValidationResult,
  PluginConfigValueMap,
} from "../types/plugin-config.types";
import {
  PluginConfigJsonFieldParseError,
  parseConfigDraftPayload,
  validateSchemaFields,
} from "../utils/plugin-config-draft";
import { flattenJsonSchema, localizeSchemaCopy } from "../utils/schema-json";

const defaultSupportMatrix: PluginConfigSchemaSnapshot["supportMatrix"] = [
  { feature: "嵌套对象", level: "supported", note: "按字段路径展平渲染。" },
  { feature: "数组", level: "supported", note: "简单数组支持编辑；复杂对象数组降级为 JSON 文本。" },
  { feature: "键值对象与联合类型", level: "degraded", note: "首版以 JSON 文本区域承接复杂结构。" },
  { feature: "自定义前端组件", level: "unsupported", note: "插件不能注入自定义前端组件。" },
];

export function createSchemaSnapshotFromRegistrySchema(
  pluginId: string,
  jsonSchema: PluginConfigJsonSchema,
): PluginConfigSchemaSnapshot {
  return {
    pluginId,
    pluginName: jsonSchema.title ?? pluginId,
    schemaTitle: localizeSchemaCopy(jsonSchema.title) ?? "插件配置",
    schemaDescription: localizeSchemaCopy(jsonSchema.description) ?? "插件注册表提供的配置结构。",
    schemaSource: "registry-api",
    fields: flattenJsonSchema(jsonSchema, {
      metadataByPath: new Map(),
      sampleAtPath: (path) => readDefaultAtPath(jsonSchema, path),
    }),
    supportMatrix: defaultSupportMatrix,
  };
}

export function toPluginConfigSnapshot(
  response: PluginConfigSnapshotResponse,
): PluginConfigSnapshot {
  return {
    configState: response.config_state,
    maskedPaths: response.masked_paths ?? [],
    missingRequired: response.missing_required ?? [],
    values: response.values,
    versionTag: response.version_tag ?? response.updated_at ?? "remote",
  };
}

export function toPluginConfigValidationResult(
  response: PluginConfigValidateResponse,
): PluginConfigValidationResult {
  return {
    ok: response.ok ?? (response.issues?.length ?? 0) === 0,
    issues: response.issues ?? [],
  };
}

export function toPluginConfigSaveResult(
  response: PluginConfigUpdateResponse,
): PluginConfigSaveResult {
  return {
    updatedAt: response.updated_at ?? new Date().toISOString(),
    versionTag: response.version_tag ?? response.updated_at ?? "remote-saved",
  };
}

export function buildPluginConfigUpdatePayload(
  schema: PluginConfigSchemaSnapshot,
  values: PluginConfigValueMap,
) {
  const fieldValidation = validateSchemaFields(schema, values);

  if (!fieldValidation.ok) {
    throw new PluginConfigValidationError(fieldValidation);
  }

  try {
    return { values: parseConfigDraftPayload(schema, values) };
  } catch (error) {
    const parseIssue = toParseIssue(schema, error);
    if (parseIssue) {
      throw new PluginConfigValidationError(parseIssue);
    }
    throw error;
  }
}

export class PluginConfigValidationError extends Error {
  readonly result: PluginConfigValidationResult;

  constructor(result: PluginConfigValidationResult) {
    super(result.issues[0]?.message ?? "配置校验失败。");
    this.name = "PluginConfigValidationError";
    this.result = result;
  }
}

function toParseIssue(
  schema: PluginConfigSchemaSnapshot,
  error: unknown,
): PluginConfigValidationResult | null {
  if (!(error instanceof PluginConfigJsonFieldParseError)) {
    return null;
  }

  const definition = schema.fields.find((field) => field.path === error.path);

  return {
    ok: false,
    issues: [
      {
        path: error.path,
        message:
          definition?.type === "integer" || definition?.type === "number"
            ? "该字段需要数字格式。"
            : "需要提供合法的 JSON 文本。",
      },
    ],
  };
}

function readDefaultAtPath(schema: PluginConfigJsonSchema, path: string): unknown {
  let current: PluginConfigJsonSchema | undefined = schema;

  for (const segment of path.split(".")) {
    current = current?.properties?.[segment];
    if (!current) {
      return undefined;
    }
  }

  return current.const ?? current.default;
}

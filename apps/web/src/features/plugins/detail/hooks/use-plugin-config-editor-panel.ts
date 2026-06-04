import { useCallback, useMemo, useState } from "react";

import { useApis } from "@/app/runtime";
import {
  buildPluginConfigUpdatePayload,
  createSchemaSnapshotFromRegistrySchema,
  isSameValueMap,
  PluginConfigValidationError,
  toPluginConfigValidationResult,
  usePluginConfigDraftState,
  usePluginConfigSaveMutation,
  usePluginConfigSchemaQuery,
  usePluginConfigValidationMutation,
  usePluginCurrentConfigQuery,
} from "@/features/plugins/config-form";

import { formatApiError } from "../utils/plugin-detail-format";
import {
  loadMockPluginConfig,
  saveMockPluginConfig,
  validateMockPluginConfig,
} from "../utils/plugin-config-mock";

export function usePluginConfigEditorPanel(pluginId: string) {
  const { plugins: pluginsApi } = useApis();
  const [message, setMessage] = useState<string | null>(null);
  const schemaQuery = usePluginConfigSchemaQuery(pluginId, async (currentPluginId) =>
    createSchemaSnapshotFromRegistrySchema(
      currentPluginId,
      await pluginsApi.fetchConfigSchema(currentPluginId),
    ),
  );
  const schema = schemaQuery.data ?? null;
  const configQuery = usePluginCurrentConfigQuery(pluginId, async () => {
    if (!schema) {
      throw new Error("加载 mock 配置前需要先准备配置结构。");
    }
    return loadMockPluginConfig(schema);
  });
  const config = configQuery.data ?? null;
  const {
    draftValues,
    initialDraftValues,
    isDirty,
    issueLookup,
    resetDraftState,
    setIssues,
    updateDraft,
  } = usePluginConfigDraftState(schema, config);

  const validationMutation = usePluginConfigValidationMutation(
    schema,
    async (schemaSnapshot, values) => {
      try {
        buildPluginConfigUpdatePayload(schemaSnapshot, values);
      } catch (error) {
        if (error instanceof PluginConfigValidationError) {
          return error.result;
        }
        throw error;
      }

      return toPluginConfigValidationResult(
        await validateMockPluginConfig(schemaSnapshot, values),
      );
    },
  );

  const saveMutation = usePluginConfigSaveMutation(
    schema,
    async (schemaSnapshot, values) => saveMockPluginConfig(schemaSnapshot, values),
  );

  const canReset = Boolean(config) && !isSameValueMap(draftValues, initialDraftValues);
  const isLoading = schemaQuery.isLoading || (schema !== null && configQuery.isLoading);
  const loadError = schemaQuery.error ?? configQuery.error ?? null;
  const savePending = saveMutation.isPending || validationMutation.isPending;

  const summaryRows = useMemo(
    () => [
      { label: "数据来源", value: "Mock 配置快照" },
      { label: "Schema 来源", value: schema?.schemaSource === "registry-api" ? "真实 config-schema" : "-" },
      { label: "字段数量", value: schema ? String(schema.fields.length) : "-" },
      { label: "版本标签", value: config?.versionTag ?? "-" },
    ],
    [config, schema],
  );

  const applyValidationError = useCallback((error: PluginConfigValidationError) => {
    setIssues(error.result.issues);
    setMessage(null);
  }, [setIssues]);

  const validateDraft = useCallback(async () => {
    if (!schema) {
      return false;
    }

    try {
      const result = await validationMutation.mutateAsync(draftValues);
      setIssues(result.issues);
      setMessage(result.ok ? "Mock 校验通过，当前字段结构可提交到后续真实接口。" : null);
      return result.ok;
    } catch (error) {
      if (error instanceof PluginConfigValidationError) {
        applyValidationError(error);
        return false;
      }

      setIssues([]);
      setMessage(formatApiError(error));
      return false;
    }
  }, [applyValidationError, draftValues, schema, setIssues, validationMutation]);

  const saveDraft = useCallback(async () => {
    if (!schema) {
      return false;
    }

    const isValid = await validateDraft();
    if (!isValid) {
      return false;
    }

    try {
      const result = await saveMutation.mutateAsync(draftValues);
      const nextConfig = await configQuery.refetch();
      if (nextConfig.data) {
        resetDraftState(nextConfig.data);
      }
      setMessage(`Mock 保存成功，版本标签：${result.versionTag}`);
      return true;
    } catch (error) {
      if (error instanceof PluginConfigValidationError) {
        applyValidationError(error);
        return false;
      }

      setMessage(formatApiError(error));
      return false;
    }
  }, [applyValidationError, configQuery, draftValues, resetDraftState, saveMutation, schema, validateDraft]);

  const resetDraft = useCallback(() => {
    if (!config) {
      return;
    }
    resetDraftState(config);
    setMessage(null);
  }, [config, resetDraftState]);

  return {
    canReset,
    config,
    configQuery,
    draftValues,
    isDirty,
    isLoading,
    issueLookup,
    loadError,
    message,
    resetDraft,
    saveDraft,
    savePending,
    schema,
    summaryRows,
    updateDraft,
    validateDraft,
  };
}

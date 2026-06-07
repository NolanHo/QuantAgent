import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useApis } from "@/app/runtime";
import {
  buildPluginConfigUpdatePayload,
  createSchemaSnapshotFromRegistrySchema,
  isSameValueMap,
  pluginConfigKeys,
  PluginConfigValidationError,
  toPluginConfigValidationResult,
  toPluginConfigSaveResult,
  toPluginConfigSnapshot,
  usePluginConfigDraftState,
  usePluginConfigSaveMutation,
  usePluginConfigSchemaQuery,
  usePluginConfigValidationMutation,
  usePluginCurrentConfigQuery,
} from "@/features/plugins/config-form";

import { formatApiError } from "../utils/plugin-detail-format";
import { pluginDetailKeys } from "../queries/plugin-detail.keys";

export function usePluginConfigEditorPanel(pluginId: string) {
  const { plugins: pluginsApi } = useApis();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const schemaQuery = usePluginConfigSchemaQuery(pluginId, async (currentPluginId) =>
    createSchemaSnapshotFromRegistrySchema(
      currentPluginId,
      await pluginsApi.fetchConfigSchema(currentPluginId),
    ),
  );
  const schema = schemaQuery.data ?? null;
  const configQuery = usePluginCurrentConfigQuery(pluginId, async (currentPluginId) =>
    toPluginConfigSnapshot(await pluginsApi.fetchConfig(currentPluginId)),
  );
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
        await pluginsApi.validateConfig(
          pluginId,
          buildPluginConfigUpdatePayload(schemaSnapshot, values),
        ),
      );
    },
  );

  const saveMutation = usePluginConfigSaveMutation(
    schema,
    async (schemaSnapshot, values) =>
      toPluginConfigSaveResult(
        await pluginsApi.updateConfig(
          pluginId,
          buildPluginConfigUpdatePayload(schemaSnapshot, values),
        ),
      ),
  );

  const canReset = Boolean(config) && !isSameValueMap(draftValues, initialDraftValues);
  const isLoading = schemaQuery.isLoading || (schema !== null && configQuery.isLoading);
  const loadError = schemaQuery.error ?? configQuery.error ?? null;
  const savePending = saveMutation.isPending || validationMutation.isPending;

  const summaryRows = useMemo(
    () => [
      { label: "数据来源", value: "后端配置值 API" },
      { label: "Schema 来源", value: schema?.schemaSource === "registry-api" ? "真实 config-schema" : "-" },
      { label: "配置状态", value: config?.configState ?? "-" },
      { label: "缺失必填", value: config?.missingRequired?.length ? config.missingRequired.join(" / ") : "0" },
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
      setMessage(result.ok ? "配置校验通过。" : null);
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
      await queryClient.invalidateQueries({ queryKey: pluginDetailKeys.detail(pluginId) });
      await queryClient.invalidateQueries({ queryKey: pluginDetailKeys.config(pluginId) });
      await queryClient.invalidateQueries({ queryKey: pluginConfigKeys.config(pluginId) });
      const nextConfig = await configQuery.refetch();
      if (nextConfig.data) {
        resetDraftState(nextConfig.data);
      }
      setMessage(`保存成功，版本标签：${result.versionTag}`);
      return true;
    } catch (error) {
      if (error instanceof PluginConfigValidationError) {
        applyValidationError(error);
        return false;
      }

      setMessage(formatApiError(error));
      return false;
    }
  }, [applyValidationError, configQuery, draftValues, pluginId, queryClient, resetDraftState, saveMutation, schema, validateDraft]);

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

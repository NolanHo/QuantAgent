import { useCallback, useMemo, useState } from "react";
import { Button, Card, Chip, Spinner, Surface } from "@heroui/react";

import { useApis } from "@/app/runtime";
import {
  buildPluginConfigUpdatePayload,
  createSchemaSnapshotFromRegistrySchema,
  isSameValueMap,
  PluginConfigForm,
  PluginConfigValidationError,
  toPluginConfigSaveResult,
  toPluginConfigSnapshot,
  toPluginConfigValidationResult,
  usePluginConfigDraftState,
  usePluginConfigSaveMutation,
  usePluginConfigSchemaQuery,
  usePluginConfigValidationMutation,
  usePluginCurrentConfigQuery,
} from "@/features/plugins/config-form";

import { formatApiError, formatSchemaSource } from "../../utils/plugin-detail-format";

type PluginConfigEditorPanelProps = {
  pluginId: string;
};

export function PluginConfigEditorPanel({ pluginId }: PluginConfigEditorPanelProps) {
  const { plugins: pluginsApi } = useApis();
  const [message, setMessage] = useState<string | null>(null);
  const schemaQuery = usePluginConfigSchemaQuery(pluginId, async (currentPluginId) =>
    createSchemaSnapshotFromRegistrySchema(
      currentPluginId,
      await pluginsApi.fetchConfigSchema(currentPluginId),
    ),
  );
  const configQuery = usePluginCurrentConfigQuery(pluginId, async (currentPluginId) =>
    toPluginConfigSnapshot(await pluginsApi.fetchConfig(currentPluginId)),
  );
  const schema = schemaQuery.data ?? null;
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
      const payload = buildPluginConfigUpdatePayload(schemaSnapshot, values);
      return toPluginConfigValidationResult(
        await pluginsApi.validateConfig(schemaSnapshot.pluginId, payload),
      );
    },
  );
  const saveMutation = usePluginConfigSaveMutation(
    schema,
    async (schemaSnapshot, values) => {
      const payload = buildPluginConfigUpdatePayload(schemaSnapshot, values);
      return toPluginConfigSaveResult(await pluginsApi.updateConfig(schemaSnapshot.pluginId, payload));
    },
  );
  const isLoading = schemaQuery.isLoading || configQuery.isLoading;
  const loadError = schemaQuery.error ?? configQuery.error ?? null;
  const savePending = saveMutation.isPending || validationMutation.isPending;
  const canReset = Boolean(config) && !isSameValueMap(draftValues, initialDraftValues);
  const summaryRows = useMemo(
    () => [
      { label: "结构来源", value: formatSchemaSource(schema?.schemaSource) },
      { label: "字段数量", value: schema ? String(schema.fields.length) : "-" },
      { label: "版本标签", value: config?.versionTag ?? "-" },
      { label: "敏感字段", value: config ? String(config.maskedPaths.length) : "-" },
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
      setMessage(result.ok ? "当前配置草稿校验通过。" : null);
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
  }, [applyValidationError, configQuery, draftValues, resetDraftState, saveMutation, schema, validateDraft]);

  const resetDraft = useCallback(() => {
    if (!config) {
      return;
    }
    resetDraftState(config);
    setMessage(null);
  }, [config, resetDraftState]);

  if (isLoading) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-lg border border-hairline bg-surface">
        <Spinner size="md" />
        <span className="ml-3 text-body-sm text-muted">正在加载插件配置...</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <Surface className="rounded-lg border border-warning/30" variant="secondary">
        <div className="p-4">
          <p className="m-0 text-title-sm font-bold text-warning">插件配置加载失败</p>
          <p className="m-0 mt-2 text-body-sm text-warning">{formatApiError(loadError)}</p>
        </div>
      </Surface>
    );
  }

  if (!schema || !config) {
    return (
      <Surface className="rounded-lg" variant="secondary">
        <div className="p-4">
          <p className="m-0 text-body-sm text-muted">当前插件没有可渲染的配置 schema。</p>
        </div>
      </Surface>
    );
  }

  return (
    <div className="grid gap-4">
      <Card className="border border-hairline bg-surface shadow-sm">
        <Card.Content className="grid gap-3 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="m-0 text-title-sm font-bold text-ink">配置表单</p>
                <Chip color={isDirty ? "warning" : "success"} size="sm" variant="soft">
                  {isDirty ? "有未保存改动" : "无改动"}
                </Chip>
              </div>
              <p className="m-0 mt-1 text-body-sm text-muted">
                {schema.schemaDescription}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button isDisabled={savePending} size="sm" type="button" variant="secondary" onPress={() => void validateDraft()}>
                校验
              </Button>
              <Button isDisabled={savePending || !canReset} size="sm" type="button" variant="secondary" onPress={resetDraft}>
                重置
              </Button>
              <Button isDisabled={savePending || !isDirty} size="sm" type="button" variant="primary" onPress={() => void saveDraft()}>
                {savePending ? "保存中" : "保存"}
              </Button>
            </div>
          </div>

          {message ? (
            <div className="rounded-md border border-hairline bg-surface-soft px-3 py-2 text-body-sm text-muted">
              {message}
            </div>
          ) : null}

          <div className="grid gap-2 text-body-sm md:grid-cols-4">
            {summaryRows.map((row) => (
              <p key={row.label} className="m-0 rounded-md border border-hairline bg-surface-soft px-3 py-2">
                <span className="block text-[11px] font-semibold text-muted">{row.label}</span>
                <span className="mt-1 block truncate font-bold text-ink">{row.value}</span>
              </p>
            ))}
          </div>
        </Card.Content>
      </Card>

      <PluginConfigForm
        issueLookup={issueLookup}
        onValueChange={updateDraft}
        schema={schema}
        showSupportMatrix={false}
        values={draftValues}
      />
    </div>
  );
}

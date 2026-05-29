import { useCallback, useEffect, useMemo, useState } from "react";
import { PageEmpty } from "@/app/components/PageEmpty";
import { PageLoading } from "@/app/components/PageLoading";
import type { PluginConfigSnapshot } from "@/features/plugins/config-form";
import { usePluginConfigDebugViewModel } from "../hooks";
import { PluginConfigDebugCards } from "./PluginConfigDebugCards";
import { PluginConfigDebugDrawer } from "./PluginConfigDebugDrawer";

export function PluginConfigDebugPanel() {
  const {
    canReset,
    config,
    currentStatus,
    draftValues,
    isDirty,
    isLoading,
    issueLookup,
    plugins,
    resetDraft,
    saveDraft,
    saveMessage,
    savePending,
    schema,
    selectPlugin,
    selectedPluginId,
    state,
    updateDraft,
    validateDraft,
  } = usePluginConfigDebugViewModel();
  const [editingPluginId, setEditingPluginId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalPortalContainer, setModalPortalContainer] =
    useState<HTMLElement | null>(null);
  const [resetBaselineConfig, setResetBaselineConfig] =
    useState<PluginConfigSnapshot | null>(null);
  const isWorkbenchLoading = isLoading && plugins.length === 0;
  const highlightedPluginId = editingPluginId ?? selectedPluginId ?? plugins[0]?.id ?? null;
  const editingPlugin = useMemo(
    () =>
      plugins.find((plugin) => plugin.id === editingPluginId) ??
      plugins.find((plugin) => plugin.id === selectedPluginId) ??
      plugins[0] ??
      null,
    [editingPluginId, plugins, selectedPluginId],
  );
  const statusTone =
    state === "save-failure" || state === "validation-error"
      ? "danger"
      : state === "save-success"
        ? "success"
        : "accent";
  const setModalPortalRef = useCallback((node: HTMLDivElement | null) => {
    setModalPortalContainer(node);
  }, []);
  const openPluginSettings = useCallback((pluginId: string) => {
    setEditingPluginId(pluginId);
    setResetBaselineConfig(null);
    selectPlugin(pluginId);
    setIsModalOpen(true);
  }, [selectPlugin]);
  const handleDrawerClose = useCallback(() => {
    setIsModalOpen(false);
    setEditingPluginId(null);
    setResetBaselineConfig(null);
  }, []);
  useEffect(() => {
    if (
      !isModalOpen ||
      !editingPluginId ||
      !config ||
      selectedPluginId !== editingPluginId ||
      resetBaselineConfig !== null
    ) {
      return;
    }

    setResetBaselineConfig({
      maskedPaths: [...config.maskedPaths],
      values: { ...config.values },
      versionTag: config.versionTag,
    });
  }, [
    config,
    editingPluginId,
    isModalOpen,
    resetBaselineConfig,
    selectedPluginId,
  ]);
  const handleResetToOpenSnapshot = useCallback(() => {
    if (!resetBaselineConfig) {
      resetDraft();
      return;
    }

    resetDraft(resetBaselineConfig);
  }, [resetBaselineConfig, resetDraft]);
  const canResetToOpenSnapshot =
    resetBaselineConfig !== null &&
    !isSameValueMap(draftValues, resetBaselineConfig.values);

  if (isWorkbenchLoading) {
    return <PageLoading message="正在加载插件配置调试样例..." />;
  }

  if (!plugins.length) {
    return (
      <PageEmpty
        title="当前没有可用插件样例"
        description="debug 插件配置表单至少需要一个受控样例来验证 schema-driven form 路径。"
      />
    );
  }

  return (
    <div ref={setModalPortalRef} className="relative">
      <PluginConfigDebugCards
        currentStatusTitle={currentStatus.title}
        highlightedPluginId={highlightedPluginId}
        onOpenPlugin={openPluginSettings}
        onSelectPlugin={selectPlugin}
        plugins={plugins}
        statusTone={statusTone}
      />

      <PluginConfigDebugDrawer
        canReset={canReset || canResetToOpenSnapshot}
        config={config}
        draftValues={draftValues}
        isDirty={isDirty}
        isLoading={isLoading}
        isOpen={isModalOpen}
        issueLookup={issueLookup}
        modalPortalContainer={modalPortalContainer}
        onClose={handleDrawerClose}
        plugin={editingPlugin}
        resetDraft={handleResetToOpenSnapshot}
        saveDraft={saveDraft}
        saveMessage={saveMessage}
        savePending={savePending}
        schema={schema}
        selectedPluginId={selectedPluginId}
        updateDraft={updateDraft}
        validateDraft={validateDraft}
      />
    </div>
  );
}

function isSameValueMap(
  left: Record<string, string>,
  right: Record<string, string>,
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  for (const key of leftKeys) {
    if (left[key] !== right[key]) {
      return false;
    }
  }

  return true;
}

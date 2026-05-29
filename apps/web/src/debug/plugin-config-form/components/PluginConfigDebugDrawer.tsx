import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { PageLoading } from "@/app/components/PageLoading";
import {
  buildPluginConfigPreviewPayload,
  type PluginConfigSchemaSnapshot,
  type PluginConfigSnapshot,
  type PluginConfigValueMap,
} from "@/features/plugins/config-form";
import {
  Button,
  CloseButton,
  Drawer,
  Tabs,
} from "@heroui/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { HiOutlineCheckBadge } from "react-icons/hi2";
import { FiRotateCcw, FiSave } from "react-icons/fi";

import type { PluginRecord } from "../model";
import { PluginConfigDebugDrawerFormPanel } from "./PluginConfigDebugDrawerFormPanel";
import { PluginConfigDebugDrawerPreviewPanel } from "./PluginConfigDebugDrawerPreviewPanel";
import { usePluginConfigDrawerWidth } from "./usePluginConfigDrawerWidth";

const MOTION_EASE = [0.22, 1, 0.36, 1] as const;

type PluginConfigDebugDrawerProps = {
  canReset: boolean;
  config: PluginConfigSnapshot | null;
  draftValues: PluginConfigValueMap;
  isDirty: boolean;
  isLoading: boolean;
  isOpen: boolean;
  issueLookup: Map<string, string>;
  modalPortalContainer: HTMLElement | null;
  onClose: () => void;
  plugin: PluginRecord | null;
  resetDraft: () => void;
  saveDraft: () => Promise<boolean>;
  saveMessage: string | null;
  savePending: boolean;
  schema: PluginConfigSchemaSnapshot | null;
  selectedPluginId: string;
  updateDraft: (path: string, nextValue: string) => void;
  validateDraft: () => Promise<boolean>;
};

export function PluginConfigDebugDrawer({
  canReset,
  config,
  draftValues,
  isDirty,
  isLoading,
  isOpen,
  issueLookup,
  modalPortalContainer,
  onClose,
  plugin,
  resetDraft,
  saveDraft,
  saveMessage,
  savePending,
  schema,
  selectedPluginId,
  updateDraft,
  validateDraft,
}: PluginConfigDebugDrawerProps) {
  const prefersReducedMotion = useReducedMotion();
  const deferredDraftValues = useDeferredValue(draftValues);
  const [previewFormatVersion, setPreviewFormatVersion] = useState(0);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [drawerTabKey, setDrawerTabKey] = useState<"form" | "preview">("form");
  const fadeSlideTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.28, ease: MOTION_EASE };
  const issues = useMemo(() => Array.from(issueLookup.entries()), [issueLookup]);
  const isModalContentReady =
    Boolean(plugin) &&
    Boolean(schema) &&
    Boolean(config) &&
    schema?.pluginId === plugin?.id &&
    selectedPluginId === plugin?.id &&
    !isLoading;
  // Keep preview parsing off the typing path until the preview tab is actually visible.
  const shouldRenderPreview = isModalContentReady && drawerTabKey === "preview";
  const previewPayload = useMemo(
    () =>
      shouldRenderPreview && schema
        ? buildPluginConfigPreviewPayload(schema, deferredDraftValues)
        : "",
    [deferredDraftValues, schema, shouldRenderPreview],
  );
  const readySchema = isModalContentReady ? schema : null;
  const {
    committedDrawerWidth,
    drawerShellRef,
    isResizingDrawer,
    setIsResizingDrawer,
  } = usePluginConfigDrawerWidth({
    isOpen,
    pluginId: plugin?.id ?? null,
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setDrawerTabKey("form");
    setPreviewFormatVersion(0);
    setPreviewMessage(null);
  }, [isOpen, plugin?.id]);

  const copyPreviewPayload = useCallback(async () => {
    if (!previewPayload) {
      return;
    }

    try {
      await navigator.clipboard.writeText(previewPayload);
      setPreviewMessage("当前样例 JSON 已复制到剪贴板。");
    } catch {
      setPreviewMessage("复制失败，请手动选中右侧 JSON 内容。");
      setDrawerTabKey("preview");
      setPreviewFormatVersion((current) => current + 1);
    }
  }, [previewPayload]);

  return (
    <AnimatePresence initial={false}>
      {isOpen ? (
        <Drawer.Backdrop
          isOpen={isOpen}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              onClose();
            }
          }}
          UNSTABLE_portalContainer={modalPortalContainer ?? undefined}
          variant="opaque"
        >
          <motion.div
            animate={{ opacity: 1 }}
            className="contents"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            transition={fadeSlideTransition}
          >
            <Drawer.Content
              className="h-full max-h-full items-stretch justify-end"
              placement="right"
            >
              <motion.div
                animate={{ opacity: 1, x: 0 }}
                className="contents"
                exit={{
                  opacity: prefersReducedMotion ? 0 : 0.92,
                  x: prefersReducedMotion ? 0 : 36,
                }}
                initial={{
                  opacity: prefersReducedMotion ? 1 : 0.98,
                  x: prefersReducedMotion ? 0 : 72,
                }}
                transition={fadeSlideTransition}
              >
                <div
                  ref={drawerShellRef}
                  className="contents"
                  style={
                    {
                      "--plugin-drawer-width": `${committedDrawerWidth}px`,
                    } as CSSProperties
                  }
                >
                  <Drawer.Dialog
                    aria-label={`${plugin?.name ?? "插件"} 配置`}
                    className="relative grid h-full max-h-full w-[min(var(--plugin-drawer-width),92vw)] max-w-none grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-none border-l border-slate-200 bg-white shadow-[-24px_0_80px_rgba(15,23,42,0.18)] sm:rounded-l-[28px]"
                  >
                    <motion.div
                      aria-label="调整抽屉宽度"
                      animate={{
                        opacity: isResizingDrawer ? 1 : 0.92,
                        scaleY: isResizingDrawer ? 1.05 : 1,
                      }}
                      className={[
                        "absolute inset-y-0 left-0 z-20 flex w-3 -translate-x-1/2 cursor-col-resize items-center justify-center",
                        isResizingDrawer
                          ? "before:bg-sky-500"
                          : "before:bg-slate-300/80 hover:before:bg-slate-400",
                        "before:block before:h-14 before:w-1 before:rounded-full before:transition-colors",
                      ].join(" ")}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        setIsResizingDrawer(true);
                      }}
                      role="separator"
                      transition={fadeSlideTransition}
                    />
                    <Drawer.Header>
                      <div className="flex min-h-[48px] w-full items-start justify-between gap-3">
                        <p className="m-0 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                          插件设置
                        </p>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {isModalContentReady ? (
                            <>
                              <Button
                                aria-label="校验插件"
                                isDisabled={savePending}
                                onPress={() => void validateDraft()}
                                size="sm"
                                type="button"
                                variant="ghost"
                              >
                                <HiOutlineCheckBadge
                                  aria-hidden="true"
                                  className="text-[15px]"
                                />
                                <span>校验</span>
                              </Button>
                              <Button
                                aria-label="重置草稿"
                                isDisabled={savePending || !canReset}
                                onPress={() => resetDraft()}
                                size="sm"
                                type="button"
                                variant="ghost"
                              >
                                <FiRotateCcw
                                  aria-hidden="true"
                                  className="text-[14px]"
                                />
                                <span>重置</span>
                              </Button>
                              <Button
                                isDisabled={savePending || !isDirty}
                                onPress={() => void saveDraft()}
                                size="sm"
                                type="button"
                                variant="primary"
                              >
                                <FiSave
                                  aria-hidden="true"
                                  className="text-[14px]"
                                />
                                <span>{savePending ? "保存中" : "保存改动"}</span>
                              </Button>
                            </>
                          ) : null}
                          <CloseButton
                            aria-label="关闭配置抽屉"
                            onPress={onClose}
                          />
                        </div>
                      </div>
                    </Drawer.Header>

                    <Drawer.Body className="min-h-0 p-0">
                      {isModalContentReady ? (
                        <Tabs
                          className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]"
                          selectedKey={drawerTabKey}
                          onSelectionChange={(key) => {
                            setDrawerTabKey(
                              key === "preview" ? "preview" : "form",
                            );
                          }}
                        >
                          <div className="border-b border-black/5 px-4 py-2.5">
                            <Tabs.ListContainer>
                              <Tabs.List aria-label="配置工作区视图">
                                <Tabs.Tab id="form">
                                  配置表单
                                  <Tabs.Indicator />
                                </Tabs.Tab>
                                <Tabs.Tab id="preview">
                                  样例配置 JSON
                                  <Tabs.Indicator />
                                </Tabs.Tab>
                              </Tabs.List>
                            </Tabs.ListContainer>
                          </div>

                          {drawerTabKey === "form" ? (
                            <PluginConfigDebugDrawerFormPanel
                              issueLookup={issueLookup}
                              saveMessage={saveMessage}
                              schema={readySchema}
                              updateDraft={updateDraft}
                              values={draftValues}
                            />
                          ) : (
                            <PluginConfigDebugDrawerPreviewPanel
                              issues={issues}
                              onCopyPreview={copyPreviewPayload}
                              onFormatPreview={() => {
                                setPreviewFormatVersion((current) => current + 1);
                              }}
                              previewFormatVersion={previewFormatVersion}
                              previewMessage={previewMessage}
                              previewPayload={previewPayload}
                            />
                          )}
                        </Tabs>
                      ) : (
                        <div className="grid h-full place-items-center">
                          <PageLoading message="正在加载插件配置弹窗..." />
                        </div>
                      )}
                    </Drawer.Body>
                  </Drawer.Dialog>
                </div>
              </motion.div>
            </Drawer.Content>
          </motion.div>
        </Drawer.Backdrop>
      ) : null}
    </AnimatePresence>
  );
}

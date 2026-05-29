import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { PageLoading } from "@/app/components/PageLoading";
import {
  buildPluginConfigPreviewPayload,
  PluginConfigForm,
  type PluginConfigSchemaSnapshot,
  type PluginConfigSnapshot,
  type PluginConfigValueMap,
} from "@/features/plugins/config-form";
import { renderHighlightedJson } from "@/features/plugins/config-form/lib/json-highlight";
import {
  Button,
  Card,
  CloseButton,
  Drawer,
  Surface,
  Tabs,
} from "@heroui/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { HiOutlineBars3BottomLeft, HiOutlineCheckBadge } from "react-icons/hi2";
import { FiCopy, FiRotateCcw, FiSave } from "react-icons/fi";

import type { PluginRecord } from "../model";

const DEFAULT_DRAWER_WIDTH = 960;
const MIN_DRAWER_WIDTH = 560;
const MAX_DRAWER_WIDTH = 1200;
const VIEWPORT_GUTTER = 32;
const DEFAULT_DRAWER_VIEWPORT_RATIO = 0.68;
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
  const [committedDrawerWidth, setCommittedDrawerWidth] = useState(
    DEFAULT_DRAWER_WIDTH,
  );
  const [isResizingDrawer, setIsResizingDrawer] = useState(false);
  const drawerShellRef = useRef<HTMLDivElement | null>(null);
  const drawerWidthRef = useRef(DEFAULT_DRAWER_WIDTH);
  const pendingDrawerWidthRef = useRef<number | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
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

  const applyDrawerWidth = useCallback((width: number) => {
    const nextWidth = clampDrawerWidth(width);
    drawerWidthRef.current = nextWidth;
    drawerShellRef.current?.style.setProperty(
      "--plugin-drawer-width",
      `${nextWidth}px`,
    );
    return nextWidth;
  }, []);

  const flushPendingDrawerWidth = useCallback(() => {
    resizeFrameRef.current = null;
    if (pendingDrawerWidthRef.current === null) {
      return;
    }

    applyDrawerWidth(pendingDrawerWidthRef.current);
    pendingDrawerWidthRef.current = null;
  }, [applyDrawerWidth]);

  const scheduleDrawerWidth = useCallback(
    (width: number) => {
      pendingDrawerWidthRef.current = width;
      if (resizeFrameRef.current !== null) {
        return;
      }

      resizeFrameRef.current = window.requestAnimationFrame(
        flushPendingDrawerWidth,
      );
    },
    [flushPendingDrawerWidth],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const nextWidth = getDefaultDrawerWidth();
    applyDrawerWidth(nextWidth);
    setCommittedDrawerWidth(nextWidth);
    setDrawerTabKey("form");
    setPreviewFormatVersion(0);
    setPreviewMessage(null);
  }, [applyDrawerWidth, isOpen, plugin?.id]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleWindowResize = () => {
      const nextWidth = applyDrawerWidth(drawerWidthRef.current);
      setCommittedDrawerWidth((current) =>
        current === nextWidth ? current : nextWidth,
      );
    };

    handleWindowResize();
    window.addEventListener("resize", handleWindowResize);

    return () => {
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [applyDrawerWidth, isOpen]);

  useEffect(() => {
    if (!isResizingDrawer) {
      return;
    }

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;

    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    // 拖拽时直接写 CSS 变量，避免每一帧都走 React render。
    const handlePointerMove = (event: PointerEvent) => {
      scheduleDrawerWidth(window.innerWidth - event.clientX);
    };

    const stopResizing = () => {
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
      if (pendingDrawerWidthRef.current !== null) {
        applyDrawerWidth(pendingDrawerWidthRef.current);
        pendingDrawerWidthRef.current = null;
      }

      setIsResizingDrawer(false);
      setCommittedDrawerWidth(drawerWidthRef.current);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResizing);
    window.addEventListener("pointercancel", stopResizing);

    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResizing);
      window.removeEventListener("pointercancel", stopResizing);
    };
  }, [applyDrawerWidth, isResizingDrawer, scheduleDrawerWidth]);

  useEffect(() => {
    return () => {
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
      }
    };
  }, []);

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
                            <Tabs.Panel
                              id="form"
                              className="min-h-0 overflow-y-auto"
                            >
                              <div className="grid gap-3.5 px-3.5 py-4 pb-6">
                                {saveMessage ? (
                                  <Surface
                                    className="rounded-[22px]"
                                    variant="secondary"
                                  >
                                    <div className="p-4">
                                      <p className="m-0 text-sm leading-6 text-slate-600">
                                        {saveMessage}
                                      </p>
                                    </div>
                                  </Surface>
                                ) : null}

                                {readySchema ? (
                                  <PluginConfigForm
                                    issueLookup={issueLookup}
                                    onValueChange={updateDraft}
                                    schema={readySchema}
                                    showSupportMatrix={false}
                                    values={draftValues}
                                  />
                                ) : null}
                              </div>
                            </Tabs.Panel>
                          ) : (
                            <Tabs.Panel
                              id="preview"
                              className="min-h-0 overflow-y-auto"
                            >
                              <div className="grid gap-3.5 px-4 py-4">
                                <Card>
                                  <Card.Header>
                                    <Card.Title>错误处理</Card.Title>
                                  </Card.Header>
                                  <Card.Content>
                                    <div className="grid gap-3">
                                      {issues.length > 0 ? (
                                        <div className="grid gap-2">
                                          <p className="m-0 text-sm font-bold text-slate-900">
                                            待修复问题
                                          </p>
                                          {issues.map(([path, message]) => (
                                            <Surface key={path} variant="secondary">
                                              <div className="grid gap-1 p-4">
                                                <p className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-red-700">
                                                  {path}
                                                </p>
                                                <p className="m-0 text-sm leading-6 text-red-900">
                                                  {message}
                                                </p>
                                              </div>
                                            </Surface>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="m-0 text-sm leading-6 text-slate-500">
                                          当前没有字段级问题，结果区会随着配置草稿实时更新。
                                        </p>
                                      )}
                                    </div>
                                  </Card.Content>
                                </Card>

                                <div>
                                  {previewMessage ? (
                                    <Surface
                                      className="mb-3 rounded-[22px]"
                                      variant="secondary"
                                    >
                                      <div className="p-4">
                                        <p className="m-0 text-sm leading-6 text-slate-600">
                                          {previewMessage}
                                        </p>
                                      </div>
                                    </Surface>
                                  ) : null}
                                  <Card>
                                    <Card.Header>
                                      <Card.Title>样例配置 JSON</Card.Title>
                                    </Card.Header>
                                    <Card.Content>
                                      <div className="grid gap-3">
                                        <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
                                          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-2.5">
                                            <div className="flex items-center gap-2">
                                              <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
                                              <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                                              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                              <Button
                                                aria-label="复制内容"
                                                isIconOnly
                                                onPress={() =>
                                                  void copyPreviewPayload()
                                                }
                                                size="sm"
                                                type="button"
                                                variant="ghost"
                                              >
                                                <FiCopy
                                                  aria-hidden="true"
                                                  className="text-[14px] text-slate-500"
                                                />
                                              </Button>
                                              <Button
                                                aria-label="格式化"
                                                isIconOnly
                                                onPress={() => {
                                                  setPreviewFormatVersion(
                                                    (current) => current + 1,
                                                  );
                                                }}
                                                size="sm"
                                                type="button"
                                                variant="ghost"
                                              >
                                                <HiOutlineBars3BottomLeft
                                                  aria-hidden="true"
                                                  className="text-[15px] text-slate-500"
                                                />
                                              </Button>
                                              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                                JSON
                                              </span>
                                            </div>
                                          </div>
                                          <div className="overflow-x-auto p-4">
                                            <pre
                                              className="m-0 min-w-full whitespace-pre text-[12px] leading-6 text-slate-900"
                                              data-format-version={previewFormatVersion}
                                            >
                                              <code className="block font-mono">
                                                {renderHighlightedJson(
                                                  previewPayload,
                                                )}
                                              </code>
                                            </pre>
                                          </div>
                                        </div>
                                      </div>
                                    </Card.Content>
                                  </Card>
                                </div>
                              </div>
                            </Tabs.Panel>
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

function clampDrawerWidth(width: number) {
  const viewportMax =
    typeof window === "undefined"
      ? MAX_DRAWER_WIDTH
      : Math.max(MIN_DRAWER_WIDTH, window.innerWidth - VIEWPORT_GUTTER);

  return Math.min(
    Math.max(width, MIN_DRAWER_WIDTH),
    Math.min(MAX_DRAWER_WIDTH, viewportMax),
  );
}

function getDefaultDrawerWidth() {
  if (typeof window === "undefined") {
    return DEFAULT_DRAWER_WIDTH;
  }

  return clampDrawerWidth(
    Math.round(window.innerWidth * DEFAULT_DRAWER_VIEWPORT_RATIO),
  );
}

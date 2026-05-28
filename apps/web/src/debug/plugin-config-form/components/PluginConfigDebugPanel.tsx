import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { PageEmpty } from "@/app/components/PageEmpty";
import { PageLoading } from "@/app/components/PageLoading";
import {
  buildPluginConfigPreviewPayload,
  PluginConfigForm,
  PluginConfigSupportMatrix,
} from "@/features/plugins/config-form";
import {
  Button,
  Card,
  Chip,
  CloseButton,
  Drawer,
  Surface,
  Tabs,
} from "@heroui/react";
import {
  FiCheckCircle,
  FiCopy,
  FiRotateCcw,
  FiSave,
  FiSettings,
} from "react-icons/fi";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { HiOutlineCheckBadge } from "react-icons/hi2";
import { HiOutlineBars3BottomLeft } from "react-icons/hi2";
import { usePluginConfigDebugViewModel } from "../hooks";

const DEFAULT_DRAWER_WIDTH = 960;
const MIN_DRAWER_WIDTH = 560;
const MAX_DRAWER_WIDTH = 1200;
const VIEWPORT_GUTTER = 32;
const DEFAULT_DRAWER_VIEWPORT_RATIO = 0.68;
const MOTION_EASE = [0.22, 1, 0.36, 1] as const;

export function PluginConfigDebugPanel() {
  const {
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
  const [previewFormatVersion, setPreviewFormatVersion] = useState(0);
  const [drawerTabKey, setDrawerTabKey] = useState<"form" | "preview">("form");
  const [drawerWidth, setDrawerWidth] = useState(DEFAULT_DRAWER_WIDTH);
  const [isResizingDrawer, setIsResizingDrawer] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const isWorkbenchLoading = isLoading && plugins.length === 0;
  const deferredDraftValues = useDeferredValue(draftValues);
  const selectedPlugin =
    plugins.find(
      (plugin) => plugin.id === (editingPluginId ?? selectedPluginId),
    ) ??
    plugins[0] ??
    null;
  const issues = Array.from(issueLookup.entries());
  const isModalContentReady =
    Boolean(editingPluginId) &&
    Boolean(schema) &&
    Boolean(config) &&
    schema?.pluginId === editingPluginId &&
    selectedPluginId === editingPluginId &&
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
  const statusTone =
    state === "save-failure" || state === "validation-error"
      ? "danger"
      : state === "save-success"
        ? "success"
        : "accent";
  const fadeSlideTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.28, ease: MOTION_EASE };
  const staggeredTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.32, ease: MOTION_EASE };
  const setModalPortalRef = useCallback((node: HTMLDivElement | null) => {
    setModalPortalContainer(node);
  }, []);

  useEffect(() => {
    if (!isModalOpen) {
      return;
    }

    const handleWindowResize = () => {
      setDrawerWidth((current) => clampDrawerWidth(current));
    };

    handleWindowResize();
    window.addEventListener("resize", handleWindowResize);

    return () => {
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [isModalOpen]);

  useEffect(() => {
    if (!isResizingDrawer) {
      return;
    }

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;

    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    // Track pointer movement on the window so dragging keeps working off the handle itself.
    const handlePointerMove = (event: PointerEvent) => {
      setDrawerWidth(clampDrawerWidth(window.innerWidth - event.clientX));
    };

    const stopResizing = () => {
      setIsResizingDrawer(false);
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
  }, [isResizingDrawer]);

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

  function openPluginSettings(pluginId: string) {
    setEditingPluginId(pluginId);
    selectPlugin(pluginId);
    setDrawerTabKey("form");
    setDrawerWidth(getDefaultDrawerWidth());
    setIsModalOpen(true);
  }

  function handleModalOpenChange(nextOpen: boolean) {
    setIsModalOpen(nextOpen);
    if (!nextOpen) {
      setEditingPluginId(null);
      setDrawerTabKey("form");
    }
  }

  async function copyPreviewPayload() {
    if (!previewPayload) {
      return;
    }

    await navigator.clipboard.writeText(previewPayload);
  }

  return (
    <div ref={setModalPortalRef} className="relative">
      <section className="grid gap-5">
        <div className="grid gap-2">
          <p className="m-0 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
            全局插件
          </p>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="grid gap-1">
              <h1 className="m-0 text-2xl font-black tracking-tight text-slate-950">
                插件管理
              </h1>
              <p className="m-0 max-w-3xl text-sm leading-6 text-slate-500">
                第一层只展示全局插件卡片。点击“设置”后打开一个右侧抽屉，左侧编辑配置，右侧固定查看
                JSON 结果。
              </p>
            </div>
            <Chip color={statusTone} size="sm" variant="soft">
              {currentStatus.title}
            </Chip>
          </div>
        </div>

        <section
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          aria-label="全局插件列表"
        >
          {plugins.map((plugin, index) => {
            const isSelected = plugin.id === selectedPlugin.id;

            return (
              <motion.div
                key={plugin.id}
                animate={{ opacity: 1, y: 0 }}
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 18 }}
                layout
                transition={{
                  ...staggeredTransition,
                  delay: prefersReducedMotion ? 0 : index * 0.04,
                }}
              >
                <Card>
                  <Card.Header>
                    <div className="grid w-full gap-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="grid gap-1">
                          <Card.Title>{plugin.name}</Card.Title>
                          <Card.Description>
                            {plugin.source === "official"
                              ? "官方插件样例"
                              : "本地运行时插件"}
                          </Card.Description>
                        </div>
                        {isSelected ? (
                          <Chip color="accent" size="sm" variant="soft">
                            当前样例
                          </Chip>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Chip color="default" size="sm" variant="soft">
                          {plugin.status}
                        </Chip>
                        <Chip color="accent" size="sm" variant="secondary">
                          插件设置
                        </Chip>
                      </div>
                    </div>
                  </Card.Header>
                  <Card.Content>
                    <div className="grid gap-4">
                      <p className="m-0 text-sm leading-6 text-slate-500">
                        用于验证 schema-driven form、敏感字段掩码和 JSON
                        结果预览，不进入正式
                        <code> /plugins </code>流程。
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          aria-label={`设置 ${plugin.name}`}
                          isIconOnly
                          onPress={() => {
                            openPluginSettings(plugin.id);
                          }}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          <FiSettings
                            aria-hidden="true"
                            className="text-[14px]"
                          />
                        </Button>
                        <Button
                          aria-label={`设为当前样例 ${plugin.name}`}
                          isIconOnly
                          onPress={() => {
                            selectPlugin(plugin.id);
                          }}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          <FiCheckCircle
                            aria-hidden="true"
                            className="text-[14px]"
                          />
                        </Button>
                      </div>
                    </div>
                  </Card.Content>
                </Card>
              </motion.div>
            );
          })}
        </section>
      </section>

      <AnimatePresence initial={false}>
        {isModalOpen ? (
          <Drawer.Backdrop
            isOpen={isModalOpen}
            onOpenChange={handleModalOpenChange}
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
                  exit={{ opacity: prefersReducedMotion ? 0 : 0.92, x: prefersReducedMotion ? 0 : 36 }}
                  initial={{ opacity: prefersReducedMotion ? 1 : 0.98, x: prefersReducedMotion ? 0 : 72 }}
                  transition={fadeSlideTransition}
                >
                  <Drawer.Dialog
                    aria-label={`${selectedPlugin?.name ?? "插件"} 配置`}
                    className="relative grid h-full max-h-full w-[min(var(--plugin-drawer-width),92vw)] max-w-none grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-none border-l border-slate-200 bg-white shadow-[-24px_0_80px_rgba(15,23,42,0.18)] sm:rounded-l-[28px]"
                    style={
                      {
                        "--plugin-drawer-width": `${drawerWidth}px`,
                      } as React.CSSProperties
                    }
                  >
              <motion.div
                aria-label="调整抽屉宽度"
                animate={{
                  opacity: isResizingDrawer ? 1 : 0.92,
                  scaleY: isResizingDrawer ? 1.05 : 1,
                }}
                className={[
                  "absolute inset-y-0 left-0 z-20 flex w-3 -translate-x-1/2 cursor-col-resize items-center justify-center",
                  isResizingDrawer ? "before:bg-sky-500" : "before:bg-slate-300/80 hover:before:bg-slate-400",
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
                <div className="relative flex min-h-[48px] w-full pr-[9.5rem] sm:pr-[12.5rem]">
                  <div className="grid gap-1">
                    <p className="m-0 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                      插件设置
                    </p>
                    <Drawer.Heading>
                      {selectedPlugin?.name ?? "插件"} 配置
                    </Drawer.Heading>
                  </div>
                  <div className="absolute right-0 top-0 flex items-center gap-2">
                    {isModalContentReady && isDirty ? (
                      <Button
                        isDisabled={savePending}
                        onPress={() => void saveDraft()}
                        size="sm"
                        type="button"
                        variant="primary"
                      >
                        <FiSave aria-hidden="true" className="text-[14px]" />
                        <span>{savePending ? "保存中" : "保存改动"}</span>
                      </Button>
                    ) : null}
                    <CloseButton
                      aria-label="关闭配置抽屉"
                      onPress={() => {
                        handleModalOpenChange(false);
                      }}
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
                      setDrawerTabKey(key === "preview" ? "preview" : "form");
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
                      <Tabs.Panel id="form" className="min-h-0 overflow-y-auto">
                        <AnimatePresence initial={false} mode="wait">
                          <motion.div
                            key={`drawer-panel-${drawerTabKey}`}
                            animate={{ opacity: 1, x: 0, y: 0 }}
                            className="grid gap-3.5 px-3.5 py-4 pb-6"
                            exit={{
                              opacity: 0,
                              x: prefersReducedMotion ? 0 : -18,
                              y: prefersReducedMotion ? 0 : 6,
                            }}
                            initial={{
                              opacity: 0,
                              x: prefersReducedMotion ? 0 : 24,
                              y: prefersReducedMotion ? 0 : 10,
                            }}
                            transition={fadeSlideTransition}
                          >
                            <motion.div layout transition={staggeredTransition}>
                              <Surface className="rounded-[22px]" variant="secondary">
                                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                                  <div className="grid gap-1">
                                    <p className="m-0 text-sm font-bold text-slate-900">
                                      当前状态
                                    </p>
                                    <p className="m-0 text-xs leading-5 text-slate-500">
                                      {currentStatus.detail}
                                    </p>
                                  </div>
                                  <Chip
                                    color={statusTone}
                                    size="sm"
                                    variant="soft"
                                  >
                                    {currentStatus.title}
                                  </Chip>
                                </div>
                              </Surface>
                            </motion.div>

                            <motion.div layout transition={staggeredTransition}>
                              <PluginConfigForm
                                containerWidth={drawerWidth}
                                issueLookup={issueLookup}
                                onValueChange={updateDraft}
                                plugins={plugins}
                                schema={schema}
                                selectedPluginId={selectedPlugin?.id}
                                showSupportMatrix={false}
                                values={draftValues}
                              />
                            </motion.div>

                            <motion.div layout transition={staggeredTransition}>
                              <Surface className="rounded-[22px]" variant="secondary">
                                <div className="grid gap-2.5 p-4">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="grid gap-1">
                                      <p className="m-0 text-sm font-bold text-slate-900">
                                        保存与校验
                                      </p>
                                      <p className="m-0 text-xs leading-5 text-slate-500">
                                        右上角保存按钮会一次性提交当前草稿；这里保留校验和重置。
                                      </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      <Button
                                        aria-label="校验插件"
                                        isIconOnly
                                        onPress={() => void validateDraft()}
                                        size="sm"
                                        type="button"
                                        variant="ghost"
                                      >
                                        <HiOutlineCheckBadge
                                          aria-hidden="true"
                                          className="text-[15px]"
                                        />
                                      </Button>
                                      <Button
                                        aria-label="重置草稿"
                                        isIconOnly
                                        onPress={() => resetDraft()}
                                        size="sm"
                                        type="button"
                                        variant="ghost"
                                      >
                                        <FiRotateCcw
                                          aria-hidden="true"
                                          className="text-[14px]"
                                        />
                                      </Button>
                                    </div>
                                  </div>
                                  {saveMessage ? (
                                    <motion.p
                                      animate={{ opacity: 1, y: 0 }}
                                      className="m-0 text-sm leading-6 text-slate-600"
                                      initial={{
                                        opacity: 0,
                                        y: prefersReducedMotion ? 0 : 8,
                                      }}
                                      transition={fadeSlideTransition}
                                    >
                                      {saveMessage}
                                    </motion.p>
                                  ) : null}
                                </div>
                              </Surface>
                            </motion.div>
                          </motion.div>
                        </AnimatePresence>
                      </Tabs.Panel>
                    ) : (
                      <Tabs.Panel
                        id="preview"
                        className="min-h-0 overflow-y-auto"
                      >
                        <AnimatePresence initial={false} mode="wait">
                          <motion.div
                            key={`drawer-panel-${drawerTabKey}`}
                            animate={{ opacity: 1, x: 0, y: 0 }}
                            className="grid gap-3.5 px-4 py-4"
                            exit={{
                              opacity: 0,
                              x: prefersReducedMotion ? 0 : 18,
                              y: prefersReducedMotion ? 0 : 6,
                            }}
                            initial={{
                              opacity: 0,
                              x: prefersReducedMotion ? 0 : -24,
                              y: prefersReducedMotion ? 0 : 10,
                            }}
                            transition={fadeSlideTransition}
                          >
                            <motion.div layout transition={staggeredTransition}>
                              <Card>
                                <Card.Header>
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="grid gap-1">
                                      <Card.Title>样例配置 JSON</Card.Title>
                                      <Card.Description>
                                        当前草稿解析后的 payload
                                        结果只在这个分页里查看。
                                      </Card.Description>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        aria-label="复制内容"
                                        isIconOnly
                                        onPress={() => void copyPreviewPayload()}
                                        size="sm"
                                        type="button"
                                        variant="ghost"
                                      >
                                        <FiCopy
                                          aria-hidden="true"
                                          className="text-[14px]"
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
                                          className="text-[15px]"
                                        />
                                      </Button>
                                    </div>
                                  </div>
                                </Card.Header>
                                <Card.Content>
                                  <div className="grid gap-3">
                                    <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-slate-950 shadow-[0_18px_40px_rgba(15,23,42,0.18)]">
                                      <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-2.5">
                                        <div className="flex items-center gap-2">
                                          <span className="h-2.5 w-2.5 rounded-full bg-rose-400/90" />
                                          <span className="h-2.5 w-2.5 rounded-full bg-amber-300/90" />
                                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
                                        </div>
                                        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                          JSON
                                        </span>
                                      </div>
                                      <div className="overflow-x-auto p-4">
                                        <motion.pre
                                          animate={{ opacity: 1, filter: "blur(0px)" }}
                                          className="m-0 min-w-full whitespace-pre text-[12px] leading-6 text-slate-100"
                                          data-format-version={previewFormatVersion}
                                          initial={{
                                            opacity: 0,
                                            filter: prefersReducedMotion
                                              ? "blur(0px)"
                                              : "blur(6px)",
                                          }}
                                          transition={fadeSlideTransition}
                                        >
                                          <code className="block font-mono">
                                            {renderHighlightedJson(previewPayload)}
                                          </code>
                                        </motion.pre>
                                      </div>
                                    </div>
                                  </div>
                                </Card.Content>
                              </Card>
                            </motion.div>

                            <motion.div layout transition={staggeredTransition}>
                              <Card>
                                <Card.Header>
                                  <div className="grid gap-1">
                                    <Card.Title>错误处理</Card.Title>
                                    <Card.Description>
                                      校验问题和支持矩阵集中放在样例 JSON
                                      分页，便于边改边核对。
                                    </Card.Description>
                                  </div>
                                </Card.Header>
                                <Card.Content>
                                  <div className="grid gap-3">
                                    {issues.length > 0 ? (
                                      <div className="grid gap-2">
                                        <p className="m-0 text-sm font-bold text-slate-900">
                                          待修复问题
                                        </p>
                                        {issues.map(([path, message], index) => (
                                          <motion.div
                                            key={path}
                                            animate={{ opacity: 1, y: 0 }}
                                            initial={{
                                              opacity: 0,
                                              y: prefersReducedMotion
                                                ? 0
                                                : 12 + index * 4,
                                            }}
                                            transition={{
                                              ...staggeredTransition,
                                              delay: prefersReducedMotion
                                                ? 0
                                                : index * 0.04,
                                            }}
                                          >
                                            <Surface variant="secondary">
                                              <div className="grid gap-1 p-4">
                                                <p className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-red-700">
                                                  {path}
                                                </p>
                                                <p className="m-0 text-sm leading-6 text-red-900">
                                                  {message}
                                                </p>
                                              </div>
                                            </Surface>
                                          </motion.div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="m-0 text-sm leading-6 text-slate-500">
                                        当前没有字段级问题，结果区会随着配置草稿实时更新。
                                      </p>
                                    )}

                                    <motion.div
                                      layout
                                      transition={staggeredTransition}
                                    >
                                      <PluginConfigSupportMatrix
                                        title="支持矩阵"
                                        description="当前视图只消费受控 schema 摘要，不接受任意 schema playground 输入。"
                                        supportMatrix={schema.supportMatrix}
                                      />
                                    </motion.div>
                                  </div>
                                </Card.Content>
                              </Card>
                            </motion.div>
                          </motion.div>
                        </AnimatePresence>
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
                </motion.div>
              </Drawer.Content>
            </motion.div>
          </Drawer.Backdrop>
        ) : null}
      </AnimatePresence>
    </div>
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

function renderHighlightedJson(source: string) {
  return source.split("\n").map((line, lineIndex, lines) => (
    <span key={`json-line-${lineIndex}`} className="block">
      {tokenizeJsonLine(line).map((token, tokenIndex) => (
        <span
          key={`json-token-${lineIndex}-${tokenIndex}`}
          className={jsonTokenClassName(token.type)}
        >
          {token.text}
        </span>
      ))}
      {lineIndex < lines.length - 1 ? "\n" : null}
    </span>
  ));
}

function tokenizeJsonLine(line: string) {
  const tokens: Array<{ text: string; type: JsonTokenType }> = [];
  let index = 0;

  while (index < line.length) {
    const current = line[index];

    if (/\s/.test(current)) {
      let end = index + 1;
      while (end < line.length && /\s/.test(line[end])) {
        end += 1;
      }
      tokens.push({ text: line.slice(index, end), type: "plain" });
      index = end;
      continue;
    }

    if (current === '"') {
      let end = index + 1;

      while (end < line.length) {
        if (line[end] === "\\" && end + 1 < line.length) {
          end += 2;
          continue;
        }
        if (line[end] === '"') {
          end += 1;
          break;
        }
        end += 1;
      }

      const text = line.slice(index, end);
      let lookahead = end;
      while (lookahead < line.length && /\s/.test(line[lookahead])) {
        lookahead += 1;
      }

      tokens.push({
        text,
        type: line[lookahead] === ":" ? "key" : "string",
      });
      index = end;
      continue;
    }

    if ("{}[],:".includes(current)) {
      tokens.push({ text: current, type: "punctuation" });
      index += 1;
      continue;
    }

    if (current === "-" || /\d/.test(current)) {
      let end = index + 1;
      while (end < line.length && /[0-9eE+.-]/.test(line[end])) {
        end += 1;
      }
      tokens.push({ text: line.slice(index, end), type: "number" });
      index = end;
      continue;
    }

    if (line.startsWith("true", index) || line.startsWith("false", index)) {
      const text = line.startsWith("true", index) ? "true" : "false";
      tokens.push({ text, type: "boolean" });
      index += text.length;
      continue;
    }

    if (line.startsWith("null", index)) {
      tokens.push({ text: "null", type: "null" });
      index += 4;
      continue;
    }

    tokens.push({ text: current, type: "plain" });
    index += 1;
  }

  return tokens;
}

type JsonTokenType =
  | "boolean"
  | "key"
  | "null"
  | "number"
  | "plain"
  | "punctuation"
  | "string";

function jsonTokenClassName(type: JsonTokenType) {
  switch (type) {
    case "key":
      return "text-sky-300";
    case "string":
      return "text-emerald-300";
    case "number":
      return "text-amber-300";
    case "boolean":
      return "text-rose-300";
    case "null":
      return "text-fuchsia-300";
    case "punctuation":
      return "text-slate-500";
    default:
      return "text-slate-100";
  }
}

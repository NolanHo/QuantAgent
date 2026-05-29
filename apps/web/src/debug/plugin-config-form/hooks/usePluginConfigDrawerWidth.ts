import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_DRAWER_WIDTH = 960;
const MIN_DRAWER_WIDTH = 560;
const MAX_DRAWER_WIDTH = 1200;
const VIEWPORT_GUTTER = 32;
const DEFAULT_DRAWER_VIEWPORT_RATIO = 0.68;

type UsePluginConfigDrawerWidthOptions = {
  isOpen: boolean;
  pluginId: string | null;
};

export function usePluginConfigDrawerWidth({
  isOpen,
  pluginId,
}: UsePluginConfigDrawerWidthOptions) {
  const [committedDrawerWidth, setCommittedDrawerWidth] = useState(
    DEFAULT_DRAWER_WIDTH,
  );
  const [isResizingDrawer, setIsResizingDrawer] = useState(false);
  const drawerShellRef = useRef<HTMLDivElement | null>(null);
  const drawerWidthRef = useRef(DEFAULT_DRAWER_WIDTH);
  const pendingDrawerWidthRef = useRef<number | null>(null);
  const resizeFrameRef = useRef<number | null>(null);

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
  }, [applyDrawerWidth, isOpen, pluginId]);

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

  return {
    committedDrawerWidth,
    drawerShellRef,
    isResizingDrawer,
    setIsResizingDrawer,
  };
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

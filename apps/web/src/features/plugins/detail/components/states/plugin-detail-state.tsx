import { Spinner } from "@heroui/react";

export function PluginDetailLoadingState() {
  return (
    <div className="flex min-h-56 items-center justify-center rounded-xl border border-hairline bg-surface">
      <div className="grid justify-items-center gap-3 text-body-sm text-muted">
        <Spinner size="md" />
        正在加载插件详情...
      </div>
    </div>
  );
}

export function PluginDetailErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-body-sm text-danger">
      插件详情加载失败：{message}
    </div>
  );
}

export function PluginDetailEmptyState({ pluginId }: { pluginId: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-5">
      <p className="m-0 text-title-sm font-bold text-ink">未找到插件</p>
      <p className="m-0 mt-2 text-body-sm text-muted">
        当前插件注册表没有返回 plugin_id={pluginId} 的插件详情；请回到列表确认插件是否仍存在。
      </p>
    </div>
  );
}

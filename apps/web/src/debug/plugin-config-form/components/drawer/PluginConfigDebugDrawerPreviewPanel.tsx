import { renderHighlightedJson } from "@/features/plugins/config-form/components/json-highlight/renderHighlightedJson";
import { Button, Card, Surface, Tabs } from "@heroui/react";
import { HiOutlineBars3BottomLeft } from "react-icons/hi2";
import { FiCopy } from "react-icons/fi";

type PluginConfigDebugDrawerPreviewPanelProps = {
  issues: Array<[string, string]>;
  onCopyPreview: () => Promise<void>;
  onFormatPreview: () => void;
  previewFormatVersion: number;
  previewMessage: string | null;
  previewPayload: string;
};

export function PluginConfigDebugDrawerPreviewPanel({
  issues,
  onCopyPreview,
  onFormatPreview,
  previewFormatVersion,
  previewMessage,
  previewPayload,
}: PluginConfigDebugDrawerPreviewPanelProps) {
  return (
    <Tabs.Panel id="preview" className="min-h-0 overflow-y-auto">
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
            <Surface className="mb-3 rounded-[22px]" variant="secondary">
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
                        onPress={() => void onCopyPreview()}
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
                        onPress={onFormatPreview}
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
                        {renderHighlightedJson(previewPayload)}
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
  );
}

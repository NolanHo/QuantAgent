import { ChevronDown } from "lucide-react";

import { AgentMarkdown } from "../conversation/AgentMarkdown";

const DEFAULT_PREVIEW_CHARS = 1200;

export function AgentCollapsibleText({
  content,
  previewChars = DEFAULT_PREVIEW_CHARS,
}: {
  content: string;
  previewChars?: number;
}) {
  const trimmed = content.trim();
  if (trimmed.length <= previewChars) {
    return <AgentMarkdown content={trimmed} />;
  }
  const preview = `${trimmed.slice(0, previewChars).trimEnd()}\n\n...`;

  return (
    <details className="group">
      <summary className="mb-2 flex cursor-pointer list-none items-center justify-between gap-3 rounded-md border border-hairline bg-canvas px-3 py-2 text-caption font-bold text-muted-strong">
        <span>输出较长，默认显示前 {previewChars} 字符</span>
        <span className="inline-flex items-center gap-1 text-primary">
          展开全文
          <ChevronDown aria-hidden className="size-3 transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="hidden group-open:block">
        <AgentMarkdown content={trimmed} />
      </div>
      <div className="group-open:hidden">
        <AgentMarkdown content={preview} />
      </div>
    </details>
  );
}

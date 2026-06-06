import { ChevronDown, FileText } from "lucide-react";
import { twMerge } from "tailwind-merge";

import type { AgentArtifactPart } from "../../types";
import { AgentMarkdown } from "../conversation/AgentMarkdown";

export function AgentReportArtifactCard({ compact = false, part }: { compact?: boolean; part: AgentArtifactPart }) {
  return (
    <details className={twMerge("group rounded-lg border border-hairline bg-canvas", compact ? "text-body-sm" : "")}>
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-3 py-3">
        <div className="grid min-w-0 gap-1">
          <div className="flex min-w-0 items-center gap-2 text-body-sm font-bold text-ink">
            <FileText aria-hidden className="size-4 shrink-0 text-primary" />
            <span className="truncate">{part.title}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-caption text-muted-strong">
            {part.agentName ? <span>{part.agentName}</span> : null}
            {part.sourceSeq ? <span className="font-mono">seq {part.sourceSeq}</span> : null}
          </div>
          {part.summary ? <div className="line-clamp-2 text-body-sm leading-5 text-muted-strong">{part.summary}</div> : null}
        </div>
        <ChevronDown aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-strong transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-hairline px-3 py-3">
        {part.contentMarkdown ? (
          <div className="max-h-[36rem] overflow-auto pr-1 text-body-sm leading-6 text-muted-strong">
            <AgentMarkdown content={part.contentMarkdown} />
          </div>
        ) : (
          <div className="grid gap-2">
            {part.rows.map((row) => (
              <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 text-body-sm" key={row.label}>
                <span className="text-muted">{row.label}</span>
                <span className="min-w-0 break-words font-semibold text-ink">{row.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

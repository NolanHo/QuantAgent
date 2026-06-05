import { ChevronDown } from "lucide-react";

import type { AgentToolPart } from "../../../types";
import { AgentMarkdown } from "../../conversation/AgentMarkdown";
import { formatPayload } from "./payload-format";

export function AgentToolNode({ part }: { part: AgentToolPart }) {
  return (
    <details className="group w-full">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-ink">
        <span className="min-w-0 truncate font-mono">{part.name}</span>
        <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-strong transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-2 grid gap-3 pl-1">
        {part.input ? <ToolPayloadSection title="input" value={formatPayload(part.input)} /> : null}
        {part.output ? (
          <ToolResultSection value={part.output} />
        ) : null}
      </div>
    </details>
  );
}

function ToolPayloadSection({ title, value }: { title: string; value: string }) {
  return (
    <section className="grid gap-1">
      <div className="text-caption font-black uppercase text-muted-strong">{title}</div>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap font-mono text-[12px] leading-5 text-muted-strong">
        {value}
      </pre>
    </section>
  );
}

function ToolResultSection({ value }: { value: string }) {
  return (
    <section className="grid gap-1">
      <div className="text-caption font-black uppercase text-muted-strong">result</div>
      <div className="text-body-sm leading-6 text-muted-strong">
        <AgentMarkdown content={value} />
      </div>
    </section>
  );
}

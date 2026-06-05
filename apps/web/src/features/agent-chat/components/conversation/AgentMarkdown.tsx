import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function AgentMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ children, href }) => (
          <a className="font-semibold text-primary underline underline-offset-4" href={href} rel="noreferrer" target="_blank">
            {children}
          </a>
        ),
        blockquote: ({ children }) => <blockquote className="my-3 border-l-2 border-hairline-strong pl-3 text-muted-strong">{children}</blockquote>,
        code: ({ children, className }) => {
          const inline = !className;
          if (inline) {
            return <code className="rounded bg-surface-elevated px-1 py-0.5 font-mono text-[12px] text-ink">{children}</code>;
          }
          return <code className={`${className ?? ""} font-mono text-[12px] leading-5`}>{children}</code>;
        },
        h1: ({ children }) => <h1 className="mb-2 mt-3 text-title-md font-bold text-ink">{children}</h1>,
        h2: ({ children }) => <h2 className="mb-2 mt-3 text-title-sm font-bold text-ink">{children}</h2>,
        h3: ({ children }) => <h3 className="mb-1 mt-3 text-body-md font-bold text-ink">{children}</h3>,
        li: ({ children }) => <li className="my-1 pl-1">{children}</li>,
        ol: ({ children }) => <ol className="my-2 list-decimal pl-5">{children}</ol>,
        p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
        pre: ({ children }) => <pre className="my-3 overflow-auto rounded-md bg-zinc-950 p-3 text-zinc-100">{children}</pre>,
        table: ({ children }) => (
          <div className="my-3 overflow-x-auto rounded-md border border-hairline">
            <table className="min-w-full border-collapse text-left text-[13px]">{children}</table>
          </div>
        ),
        tbody: ({ children }) => <tbody>{children}</tbody>,
        td: ({ children }) => <td className="border-t border-hairline px-3 py-2 align-top">{children}</td>,
        th: ({ children }) => <th className="bg-surface-soft px-3 py-2 font-bold text-ink">{children}</th>,
        thead: ({ children }) => <thead>{children}</thead>,
        ul: ({ children }) => <ul className="my-2 list-disc pl-5">{children}</ul>,
      }}
    >
      {repairStreamingMarkdown(content)}
    </ReactMarkdown>
  );
}

function repairStreamingMarkdown(value: string): string {
  const fenceMatches = value.match(/```/g);
  if (fenceMatches && fenceMatches.length % 2 === 1) return `${value}\n\`\`\``;
  return value;
}

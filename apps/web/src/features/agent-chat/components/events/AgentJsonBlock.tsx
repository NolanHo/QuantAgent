export function AgentJsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="m-0 max-h-72 overflow-auto rounded-md bg-zinc-950 p-3 font-mono text-[11px] leading-4 text-zinc-100">
      {stringifyJson(value)}
    </pre>
  );
}

export function stringifyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

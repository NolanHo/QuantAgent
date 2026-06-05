export function KeyValueRows({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <div className="grid gap-2 rounded-md border border-hairline bg-surface-soft px-3 py-2">
      {rows.map((row) => (
        <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 text-body-sm" key={row.label}>
          <span className="text-muted">{row.label}</span>
          <span className="min-w-0 break-words font-semibold text-ink">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

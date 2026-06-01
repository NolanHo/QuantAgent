export type KeyValueRow = {
  label: string;
  value: string;
};

export function KeyValueGrid({ rows }: { rows: readonly KeyValueRow[] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map((row) => (
        <div
          key={row.label}
          className="rounded-lg border border-hairline bg-surface-soft px-3 py-2.5"
        >
          <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            {row.label}
          </dt>
          <dd className="mt-1 break-words text-body-sm font-semibold text-ink">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

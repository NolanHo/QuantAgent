export function DetailFacts({ rows }: { rows: readonly string[] }) {
  return (
    <div className="grid gap-3">
      {rows.map((row) => (
        <p key={row} className="m-0 text-body-sm text-muted">
          {row}
        </p>
      ))}
    </div>
  )
}

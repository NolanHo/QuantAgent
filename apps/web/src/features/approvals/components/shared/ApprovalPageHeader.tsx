export function ApprovalPageHeader({
  kicker,
  title,
  description,
}: {
  kicker: string
  title: string
  description: string
}) {
  return (
    <section className="grid gap-2">
      <p className="m-0 text-body-sm font-extrabold uppercase tracking-[0.04em] text-info">
        {kicker}
      </p>
      <h1 className="m-0 text-title-lg font-bold text-ink">
        {title}
      </h1>
      <p className="m-0 max-w-[70ch] text-body-sm text-muted">
        {description}
      </p>
    </section>
  )
}

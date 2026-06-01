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
      <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[rgb(3,105,161)]">
        {kicker}
      </p>
      <h1 className="m-0 text-[26px] leading-[1.08] font-bold text-ink sm:text-[30px]">
        {title}
      </h1>
      <p className="m-0 max-w-[70ch] text-body-sm text-muted">
        {description}
      </p>
    </section>
  )
}

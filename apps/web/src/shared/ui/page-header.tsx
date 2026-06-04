export function PageHeader({
  kicker,
  title,
  titleClassName,
  description,
}: {
  kicker?: string
  title: string
  titleClassName?: string
  description?: string
}) {
  return (
    <section className="page-header">
      {kicker ? <p className="page-kicker">{kicker}</p> : null}
      <h1 className={['page-title', titleClassName].filter(Boolean).join(' ')}>{title}</h1>
      {description ? <p className="page-description">{description}</p> : null}
    </section>
  )
}

export function PageHeader({
  kicker,
  title,
  description,
}: {
  kicker: string
  title: string
  description: string
}) {
  return (
    <section className="page-header">
      <p className="page-kicker">{kicker}</p>
      <h1 className="page-title">{title}</h1>
      <p className="page-description">{description}</p>
    </section>
  )
}

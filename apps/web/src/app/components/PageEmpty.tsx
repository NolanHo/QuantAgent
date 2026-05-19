import { useId, type ReactNode } from 'react'

export function PageEmpty({
  title,
  description,
  cta,
}: {
  title: string
  description: string
  cta?: ReactNode
}) {
  const titleId = useId()

  return (
    <section className="page-state page-state-empty" aria-labelledby={titleId}>
      <span className="page-empty-mark" aria-hidden="true">
        <span className="page-empty-mark-line" />
        <span className="page-empty-mark-line" />
      </span>
      <div className="page-state-copy">
        <p className="page-state-eyebrow">No content</p>
        <h2 id={titleId} className="page-state-title">
          {title}
        </h2>
        <p className="page-state-description">{description}</p>
      </div>
      {cta ? <div className="page-state-actions">{cta}</div> : null}
    </section>
  )
}

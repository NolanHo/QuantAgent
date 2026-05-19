import type { ReactNode } from 'react'

export function PageEmpty({
  title,
  description,
  cta,
}: {
  title: string
  description: string
  cta?: ReactNode
}) {
  return (
    <section className="page-state page-state-empty">
      <span className="page-empty-mark" aria-hidden="true" />
      <div className="page-state-copy">
        <h2 className="page-state-title">{title}</h2>
        <p className="page-state-description">{description}</p>
      </div>
      {cta ? <div className="page-state-actions">{cta}</div> : null}
    </section>
  )
}

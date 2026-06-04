export function ApprovalPageHeader({
  align = 'start',
  kicker,
  size = 'default',
  title,
  description,
}: {
  align?: 'start' | 'center'
  kicker?: string
  size?: 'default' | 'hero'
  title: string
  description: string
}) {
  const isCenter = align === 'center'
  const isHero = size === 'hero'

  return (
    <section className={isCenter ? 'grid gap-3 justify-items-center text-center' : 'grid gap-2'}>
      {kicker ? (
        <p className={isCenter
          ? 'm-0 text-[11px] font-extrabold uppercase tracking-[0.12em] text-info'
          : 'm-0 text-body-sm font-extrabold uppercase tracking-[0.04em] text-info'}
        >
          {kicker}
        </p>
      ) : null}
      <h1 className={isHero
        ? 'm-0 max-w-[16ch] text-[30px] leading-[1.08] font-bold text-ink sm:text-[36px]'
        : 'm-0 text-title-lg font-bold text-ink'}
      >
        {title}
      </h1>
      <p className={isCenter
        ? 'm-0 max-w-[58ch] text-body-sm leading-6 text-muted'
        : 'm-0 max-w-[70ch] text-body-sm text-muted'}
      >
        {description}
      </p>
    </section>
  )
}

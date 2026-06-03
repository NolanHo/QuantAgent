export function InfoTag({ children }: { children: string }) {
  return (
    <span className="inline-flex min-h-[26px] items-center rounded-full bg-surface px-3 text-body-sm font-bold text-muted-strong">
      {children}
    </span>
  )
}

export function PageLoading({ message = 'Loading page state...' }: { message?: string }) {
  return (
    <section className="page-state" role="status" aria-live="polite" aria-busy="true">
      <span className="page-loading-mark" aria-hidden="true" />
      <p className="page-state-title">{message}</p>
    </section>
  )
}

import { Spinner } from '@heroui/react'

import styles from './PageLoading.module.css'

export function PageLoading({ message = 'Loading page state...' }: { message?: string }) {
  return (
    <section className={styles.state} role="status" aria-live="polite" aria-busy="true">
      <Spinner className={styles.mark} color="accent" size="md" aria-hidden="true" />
      <p className={styles.title}>{message}</p>
    </section>
  )
}

import { Card } from '@heroui/react'

import styles from './PlaceholderPanel.module.css'

export function PlaceholderPanel({ title, copy }: { title: string; copy: string }) {
  return (
    <Card className={styles.panel}>
      <Card.Header>
        <Card.Title className={styles.title}>{title}</Card.Title>
      </Card.Header>
      <Card.Content>
        <Card.Description className={styles.copy}>{copy}</Card.Description>
      </Card.Content>
    </Card>
  )
}

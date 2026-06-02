import {
  Chip,
} from '@heroui/react'
import { twMerge } from 'tailwind-merge'

import type { EventCenterFilterOption } from '../../types/event-center.types'

const activeChipClass = 'bg-primary/10 text-primary'
const mutedChipClass = 'bg-surface-soft text-muted-strong'

export function MockFilterBar({
  title,
  options,
}: {
  title: string
  options: readonly EventCenterFilterOption[]
}) {
  return (
    <div className="grid gap-2">
      <p className="m-0 text-[12px] font-bold text-muted">{title}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Chip
            key={option.value}
            className={twMerge('text-body-sm font-bold', option.active ? activeChipClass : mutedChipClass)}
            size="sm"
            variant="soft"
          >
            {option.label}
          </Chip>
        ))}
      </div>
    </div>
  )
}

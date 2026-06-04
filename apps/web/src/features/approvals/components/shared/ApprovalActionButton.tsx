import { Button } from '@heroui/react'
import { Check, CircleDashed, X } from 'lucide-react'
import type { ReactNode } from 'react'

import type { ApprovalActionType } from '../../types/approval-workbench.types'

const actionMeta: Record<ApprovalActionType, {
  icon: ReactNode
  label: string
  variant: 'primary' | 'danger-soft' | 'outline'
}> = {
  approve: {
    icon: <Check className="size-3.5" />,
    label: '批准',
    variant: 'primary',
  },
  reject: {
    icon: <X className="size-3.5" />,
    label: '拒绝',
    variant: 'danger-soft',
  },
  request_reanalysis: {
    icon: <CircleDashed className="size-3.5" />,
    label: '重分析',
    variant: 'outline',
  },
}

export function ApprovalActionButton({
  isDisabled = false,
  onPress,
  type,
  variant,
}: {
  isDisabled?: boolean
  onPress?: () => void
  type: ApprovalActionType
  variant?: 'primary' | 'danger-soft' | 'outline' | 'ghost'
}) {
  const meta = actionMeta[type]

  return (
    <Button
      isDisabled={isDisabled}
      size="sm"
      variant={variant ?? meta.variant}
      onPress={onPress}
    >
      <span className="inline-flex items-center gap-1.5">
        {meta.icon}
        <span>{meta.label}</span>
      </span>
    </Button>
  )
}

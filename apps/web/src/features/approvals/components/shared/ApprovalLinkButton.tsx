import { Button } from '@heroui/react'
import { Link, type LinkProps } from '@tanstack/react-router'
import type { ReactNode } from 'react'

interface ApprovalLinkButtonProps extends Pick<LinkProps, 'to' | 'params'> {
  children: ReactNode
  variant?: 'primary' | 'outline' | 'ghost' | 'secondary' | 'tertiary'
  className?: string
}

export function ApprovalLinkButton({
  children,
  className,
  params,
  to,
  variant = 'primary',
}: ApprovalLinkButtonProps) {
  return (
    <Link className="inline-flex" params={params} to={to}>
      <Button className={className} size="sm" variant={variant}>
        {children}
      </Button>
    </Link>
  )
}

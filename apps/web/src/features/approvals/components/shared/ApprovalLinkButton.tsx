import { buttonVariants } from '@heroui/react'
import { Link, type LinkProps } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

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
    <Link
      className={twMerge(buttonVariants({ size: 'sm', variant }), className)}
      params={params}
      to={to}
    >
      {children}
    </Link>
  )
}

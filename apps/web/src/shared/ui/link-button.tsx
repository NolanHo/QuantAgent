import { buttonVariants } from '@heroui/react'
import { Link, type LinkProps } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

interface LinkButtonProps extends Pick<LinkProps, 'to' | 'params'> {
  children: ReactNode
  className?: string
  variant?: 'primary' | 'outline' | 'ghost' | 'secondary' | 'tertiary'
}

export function LinkButton({
  children,
  className,
  params,
  to,
  variant = 'primary',
}: LinkButtonProps) {
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

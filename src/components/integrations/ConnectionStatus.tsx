'use client'

import { cn } from '@/lib/utils'
import { CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react'

export type ConnectionStatusType = 'connected' | 'disconnected' | 'error' | 'loading'

interface ConnectionStatusProps {
  status: ConnectionStatusType
  label?: string
  errorMessage?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const STATUS_CONFIG: Record<ConnectionStatusType, {
  icon: typeof CheckCircle2
  label: string
  bgColor: string
  textColor: string
  iconColor: string
  dotColor: string
}> = {
  connected: {
    icon: CheckCircle2,
    label: 'Connected',
    bgColor: 'bg-[var(--success-bg)]',
    textColor: 'text-[#16a34a]',
    iconColor: 'text-[var(--success)]',
    dotColor: 'bg-[var(--success)]',
  },
  disconnected: {
    icon: XCircle,
    label: 'Disconnected',
    bgColor: 'bg-[var(--muted)]',
    textColor: 'text-[var(--muted-foreground)]',
    iconColor: 'text-[var(--muted-foreground)]',
    dotColor: 'bg-[var(--muted-foreground)]',
  },
  error: {
    icon: AlertTriangle,
    label: 'Error',
    bgColor: 'bg-[var(--error-bg)]',
    textColor: 'text-[var(--error)]',
    iconColor: 'text-[var(--error)]',
    dotColor: 'bg-[var(--error)]',
  },
  loading: {
    icon: Loader2,
    label: 'Checking...',
    bgColor: 'bg-[var(--info-bg)]',
    textColor: 'text-[var(--info)]',
    iconColor: 'text-[var(--info)]',
    dotColor: 'bg-[var(--info)]',
  },
}

export function ConnectionStatus({
  status,
  label,
  errorMessage,
  size = 'md',
  className,
}: ConnectionStatusProps) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  const sizeClasses = {
    sm: 'px-2.5 py-1 text-xs gap-1.5',
    md: 'px-3.5 py-2 text-sm gap-2',
    lg: 'px-5 py-3 text-base gap-3',
  }

  const iconSizes = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  }

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div
        className={cn(
          'inline-flex items-center rounded-full font-medium',
          config.bgColor,
          config.textColor,
          sizeClasses[size]
        )}
      >
        <Icon
          className={cn(
            iconSizes[size],
            config.iconColor,
            status === 'loading' && 'animate-spin'
          )}
        />
        <span>{label ?? config.label}</span>
      </div>
      {errorMessage && status === 'error' && (
        <p className="text-xs text-[var(--error)] pl-1">{errorMessage}</p>
      )}
    </div>
  )
}

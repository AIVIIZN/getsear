'use client'

import { cn } from '@/lib/utils'

interface RunningLowBadgeProps {
  remaining?: number
  className?: string
}

/**
 * Yellow "LOW" badge for items near their threshold.
 * Shows remaining count if quantity-tracked.
 */
export function RunningLowBadge({ remaining, className }: RunningLowBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200',
        className
      )}
    >
      LOW
      {remaining !== undefined && remaining > 0 && (
        <span className="tabular-nums">{remaining}</span>
      )}
    </span>
  )
}

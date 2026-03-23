'use client'

import { cn } from '@/lib/utils'

interface EightySixBadgeProps {
  className?: string
}

/**
 * Red diagonal "86" stamp overlay for item cards.
 * Rotated -12deg, semi-transparent red background.
 * Place this inside a position:relative container.
 */
export function EightySixBadge({ className }: EightySixBadgeProps) {
  return (
    <div
      className={cn(
        'absolute inset-0 z-10 flex items-center justify-center rounded-xl pointer-events-none',
        className
      )}
    >
      <div
        className="flex items-center justify-center rounded-md bg-destructive/15 px-4 py-1.5"
        style={{ transform: 'rotate(-12deg)' }}
      >
        <span className="text-lg font-black tracking-wider text-destructive">
          86
        </span>
      </div>
    </div>
  )
}

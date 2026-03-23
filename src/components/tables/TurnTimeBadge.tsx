'use client'

import { cn } from '@/lib/utils'
import {
  getElapsedMinutes,
  formatElapsedTime,
  getTurnTimeColor,
  TURN_TIME_COLORS,
  type Daypart,
} from '@/lib/tables/turn-time-calc'

interface TurnTimeBadgeProps {
  seatedAt: string | null
  targetMinutes?: number
  daypart?: Daypart
  className?: string
  /** Compact mode for floor plan overlay */
  compact?: boolean
}

/**
 * Color-coded elapsed time badge for occupied tables.
 * Green (<target), Yellow (at target), Orange (over target), Red (critical - flashing).
 */
export function TurnTimeBadge({
  seatedAt,
  targetMinutes,
  daypart,
  className,
  compact = false,
}: TurnTimeBadgeProps) {
  if (!seatedAt) return null

  const elapsed = getElapsedMinutes(seatedAt)
  const color = getTurnTimeColor(elapsed, targetMinutes, daypart)
  const colorStyles = TURN_TIME_COLORS[color]
  const label = formatElapsedTime(elapsed)

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium tabular-nums',
        colorStyles.bg,
        colorStyles.text,
        color === 'red' && 'animate-pulse',
        compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-xs',
        className
      )}
    >
      {label}
    </span>
  )
}

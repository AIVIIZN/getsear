'use client'

import { cn } from '@/lib/utils'
import { getSeatColor } from '@/lib/constants'

interface SeatSelectorProps {
  guestCount: number
  activeSeat: number | null
  onSelect: (seat: number | null) => void
}

export function SeatSelector({ guestCount, activeSeat, onSelect }: SeatSelectorProps) {
  const seats = Array.from({ length: guestCount }, (_, i) => i + 1)

  return (
    <div className="flex gap-1 overflow-x-auto scrollbar-hide py-1">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          'btn-press touch-target shrink-0 rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-150',
          activeSeat === null
            ? 'bg-[var(--foreground)] text-white shadow-warm-sm'
            : 'bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
        )}
      >
        All
      </button>
      {seats.map((seat) => {
        const color = getSeatColor(seat) ?? 'var(--color-text-muted)'
        const isActive = activeSeat === seat

        return (
          <button
            key={seat}
            type="button"
            onClick={() => onSelect(seat)}
            className={cn(
              'btn-press touch-target shrink-0 rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-150',
              'flex items-center gap-1.5',
              isActive
                ? 'text-white shadow-warm-sm'
                : 'hover:bg-[var(--muted)]'
            )}
            style={{
              backgroundColor: isActive
                ? color
                : `${color}1A`, // ~10% opacity
              color: isActive ? 'var(--color-neutral-0)' : color,
            }}
          >
            {/* Colored dot */}
            <span
              className="shrink-0 rounded-full"
              style={{
                width: 8,
                height: 8,
                backgroundColor: isActive ? 'rgba(255,255,255,0.8)' : color,
              }}
            />
            {seat}
          </button>
        )
      })}
    </div>
  )
}

'use client'

import { cn } from '@/lib/utils'

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
            ? 'bg-[var(--primary)] text-white shadow-warm-sm'
            : 'bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
        )}
      >
        All
      </button>
      {seats.map((seat) => (
        <button
          key={seat}
          type="button"
          onClick={() => onSelect(seat)}
          className={cn(
            'btn-press touch-target shrink-0 rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-150',
            activeSeat === seat
              ? 'bg-[var(--primary)] text-white shadow-warm-sm'
              : 'bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
          )}
        >
          {seat}
        </button>
      ))}
    </div>
  )
}

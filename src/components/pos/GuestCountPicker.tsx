'use client'

import { Minus, Plus, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GuestCountPickerProps {
  count: number
  onChange: (count: number) => void
  className?: string
}

export function GuestCountPicker({ count, onChange, className }: GuestCountPickerProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Users className="h-4 w-4 text-muted-foreground" />
      <span className="text-xs font-medium text-muted-foreground">Guests</span>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, count - 1))}
          disabled={count <= 1}
          className="btn-press flex h-7 w-7 items-center justify-center rounded-md border border-border bg-white text-foreground transition-colors hover:bg-muted disabled:opacity-30"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="tabular-nums w-8 text-center text-sm font-semibold">{count}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(99, count + 1))}
          disabled={count >= 99}
          className="btn-press flex h-7 w-7 items-center justify-center rounded-md border border-border bg-white text-foreground transition-colors hover:bg-muted disabled:opacity-30"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

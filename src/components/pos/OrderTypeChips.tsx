'use client'

import { cn } from '@/lib/utils'

type OrderType = 'dine_in' | 'takeout' | 'delivery' | 'bar'

interface OrderTypeChipsProps {
  value: string
  onChange: (type: OrderType) => void
}

const ORDER_TYPE_CONFIG: { type: OrderType; label: string; colorVar: string }[] = [
  { type: 'dine_in', label: 'Dine In', colorVar: 'var(--order-dinein)' },
  { type: 'takeout', label: 'Takeout', colorVar: 'var(--order-takeout)' },
  { type: 'delivery', label: 'Delivery', colorVar: 'var(--order-delivery)' },
  { type: 'bar', label: 'Bar', colorVar: 'var(--order-bar)' },
]

export function OrderTypeChips({ value, onChange }: OrderTypeChipsProps) {
  return (
    <div className="flex gap-1.5">
      {ORDER_TYPE_CONFIG.map(({ type, label, colorVar }) => {
        const isActive = value === type
        return (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            className={cn(
              'btn-press touch-target flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition-all duration-150',
              'border-2 text-center',
              isActive ? 'text-white shadow-warm-sm' : 'bg-white text-[var(--foreground)] opacity-60'
            )}
            style={{
              borderColor: colorVar,
              backgroundColor: isActive ? colorVar : undefined,
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

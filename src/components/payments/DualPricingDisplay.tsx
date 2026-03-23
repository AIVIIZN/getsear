'use client'

import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { formatCentsToDollars } from '@/lib/payments/dual-pricing'
import { cn } from '@/lib/utils'

interface DualPricingDisplayProps {
  /** Card price in cents (the menu/posted price) */
  cardPriceCents: number
  /** Cash price in cents (the discounted price) */
  cashPriceCents: number
  /** Whether dual pricing is enabled for this location */
  isEnabled: boolean
  /** Display variant */
  variant?: 'inline' | 'card' | 'receipt' | 'compact'
  className?: string
}

/**
 * Displays card vs. cash pricing side by side.
 * Only renders when dual pricing is enabled for the location.
 *
 * Variants:
 * - 'inline': Side-by-side text, used in order summary
 * - 'card': Styled card with savings highlight, used in payment flow
 * - 'receipt': Plain text format for receipt printing
 * - 'compact': Minimal, for menu item display
 */
export function DualPricingDisplay({
  cardPriceCents,
  cashPriceCents,
  isEnabled,
  variant = 'inline',
  className,
}: DualPricingDisplayProps) {
  if (!isEnabled || cardPriceCents === cashPriceCents) {
    return null
  }

  const savingsCents = cardPriceCents - cashPriceCents

  if (variant === 'receipt') {
    return (
      <div className={cn('font-mono text-xs', className)}>
        <span>Card: {formatCentsToDollars(cardPriceCents)}</span>
        <span className="mx-2">|</span>
        <span>Cash: {formatCentsToDollars(cashPriceCents)}</span>
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-2 text-xs', className)}>
        <span className="text-muted-foreground">
          Card <MoneyDisplay cents={cardPriceCents} className="inline" />
        </span>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium text-green-600">
          Cash <MoneyDisplay cents={cashPriceCents} className="inline" />
        </span>
      </div>
    )
  }

  if (variant === 'card') {
    return (
      <div
        className={cn(
          'rounded-xl border border-green-200 bg-green-50 p-4',
          className
        )}
      >
        <div className="flex items-center justify-between">
          {/* Card price */}
          <div className="text-center">
            <p className="text-xs font-medium text-muted-foreground">Card Price</p>
            <MoneyDisplay
              cents={cardPriceCents}
              className="text-lg font-bold text-foreground"
            />
          </div>

          {/* Divider */}
          <div className="mx-3 h-10 w-px bg-green-200" />

          {/* Cash price */}
          <div className="text-center">
            <p className="text-xs font-medium text-green-700">Cash Price</p>
            <MoneyDisplay
              cents={cashPriceCents}
              className="text-lg font-bold text-green-700"
            />
          </div>
        </div>

        {/* Savings badge */}
        {savingsCents > 0 && (
          <div className="mt-3 rounded-lg bg-green-100 py-1.5 text-center">
            <span className="text-sm font-semibold text-green-700">
              Save {formatCentsToDollars(savingsCents)} with cash
            </span>
          </div>
        )}
      </div>
    )
  }

  // Default: inline
  return (
    <div className={cn('flex items-center gap-3 text-sm', className)}>
      <span className="text-muted-foreground">
        Card: <MoneyDisplay cents={cardPriceCents} className="inline font-semibold text-foreground" />
      </span>
      <span className="text-muted-foreground">|</span>
      <span className="text-muted-foreground">
        Cash: <MoneyDisplay cents={cashPriceCents} className="inline font-semibold text-green-600" />
      </span>
      {savingsCents > 0 && (
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
          Save {formatCentsToDollars(savingsCents)}
        </span>
      )}
    </div>
  )
}

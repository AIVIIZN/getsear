'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { Delete, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OpenPriceItem {
  id: string
  name: string
  price_type: 'open' | 'market_price'
  min_price_cents: number | null
  max_price_cents: number | null
}

interface OpenPriceDialogProps {
  item: OpenPriceItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirmPrice: (priceCents: number) => void
}

const NUMPAD_KEYS = [
  '1', '2', '3',
  '4', '5', '6',
  '7', '8', '9',
  '.', '0', 'delete',
] as const

function formatCentsInput(input: string): { display: string; cents: number } {
  // Remove any non-numeric characters except the decimal
  const clean = input.replace(/[^0-9.]/g, '')

  // Parse as dollars
  const parts = clean.split('.')
  const dollars = parts[0] || '0'
  const decimalPart = parts[1]?.slice(0, 2) ?? ''

  // Build display
  let display: string
  if (clean.includes('.')) {
    display = `$${Number(dollars).toLocaleString()}.${decimalPart}`
  } else if (clean === '' || clean === '0') {
    display = '$0.00'
  } else {
    display = `$${Number(dollars).toLocaleString()}`
  }

  // Calculate cents
  const dollarsNum = parseInt(dollars, 10) || 0
  const centsNum = parseInt(decimalPart.padEnd(2, '0'), 10) || 0
  const totalCents = dollarsNum * 100 + centsNum

  return { display, cents: totalCents }
}

export function OpenPriceDialog({ item, open, onOpenChange, onConfirmPrice }: OpenPriceDialogProps) {
  const [input, setInput] = useState('')

  const { display, cents } = useMemo(() => formatCentsInput(input), [input])

  const handleKey = useCallback((key: string) => {
    if (key === 'delete') {
      setInput((prev) => prev.slice(0, -1))
      return
    }

    if (key === '.') {
      setInput((prev) => {
        if (prev.includes('.')) return prev
        if (prev === '') return '0.'
        return prev + '.'
      })
      return
    }

    // Limit input length
    setInput((prev) => {
      if (prev.length >= 8) return prev
      // Prevent more than 2 decimal places
      if (prev.includes('.')) {
        const afterDecimal = prev.split('.')[1]
        if (afterDecimal && afterDecimal.length >= 2) return prev
      }
      return prev + key
    })
  }, [])

  const handleClear = useCallback(() => {
    setInput('')
  }, [])

  const validationError = useMemo(() => {
    if (!item || cents === 0) return null
    if (item.min_price_cents !== null && cents < item.min_price_cents) {
      return `Minimum price: $${(item.min_price_cents / 100).toFixed(2)}`
    }
    if (item.max_price_cents !== null && cents > item.max_price_cents) {
      return `Maximum price: $${(item.max_price_cents / 100).toFixed(2)}`
    }
    return null
  }, [item, cents])

  const canSubmit = cents > 0 && !validationError

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return
    onConfirmPrice(cents)
    setInput('')
    onOpenChange(false)
  }, [canSubmit, cents, onConfirmPrice, onOpenChange])

  const handleClose = useCallback(() => {
    setInput('')
    onOpenChange(false)
  }, [onOpenChange])

  if (!item) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-[360px]! rounded-2xl! p-0! gap-0!"
        showCloseButton={false}
      >
        <DialogHeader className="px-5 pt-5 pb-3 text-center">
          <DialogTitle className="text-lg font-bold text-center">
            {item.price_type === 'market_price' ? 'Market Price' : 'Enter Price'}
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground">
            {item.name}
          </DialogDescription>
        </DialogHeader>

        {/* Price display */}
        <div className="px-5 py-4">
          <div
            className={cn(
              'flex items-center justify-center rounded-xl border-2 bg-white transition-colors',
              validationError
                ? 'border-[var(--error)]'
                : cents > 0
                  ? 'border-[var(--primary)]'
                  : 'border-[var(--border)]'
            )}
            style={{ height: 64 }}
          >
            <span className={cn(
              'text-3xl font-bold tabular-nums font-mono',
              cents === 0 ? 'text-muted-foreground' : 'text-foreground'
            )}>
              {display}
            </span>
          </div>

          {/* Validation error */}
          {validationError && (
            <div className="flex items-center justify-center gap-1.5 mt-2 text-[var(--error)] text-xs font-medium">
              <AlertCircle className="h-3.5 w-3.5" />
              {validationError}
            </div>
          )}

          {/* Min/Max hint */}
          {!validationError && (item.min_price_cents !== null || item.max_price_cents !== null) && (
            <p className="text-center text-xs text-muted-foreground mt-2">
              {item.min_price_cents !== null && item.max_price_cents !== null
                ? <>Range: <MoneyDisplay cents={item.min_price_cents} /> &ndash; <MoneyDisplay cents={item.max_price_cents} /></>
                : item.min_price_cents !== null
                  ? <>Min: <MoneyDisplay cents={item.min_price_cents} /></>
                  : <>Max: <MoneyDisplay cents={item.max_price_cents!} /></>
              }
            </p>
          )}
        </div>

        {/* Numpad */}
        <div className="px-5 pb-3">
          <div className="grid grid-cols-3 gap-2">
            {NUMPAD_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  if (key === 'delete') {
                    handleKey('delete')
                  } else {
                    handleKey(key)
                  }
                }}
                className={cn(
                  'flex items-center justify-center rounded-xl text-lg font-semibold transition-all duration-100 active:scale-95',
                  key === 'delete'
                    ? 'bg-[var(--secondary,hsl(38,25%,95%))] text-muted-foreground hover:bg-[var(--muted)]'
                    : 'bg-[var(--background-inverse,hsl(24,12%,14%))] text-white hover:opacity-90'
                )}
                style={{ height: 52 }}
              >
                {key === 'delete' ? (
                  <Delete className="h-5 w-5" />
                ) : (
                  key
                )}
              </button>
            ))}
          </div>

          {/* Clear button */}
          <button
            type="button"
            onClick={handleClear}
            className="w-full mt-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            style={{ minHeight: 36 }}
          >
            Clear
          </button>
        </div>

        <DialogFooter className="px-5 pb-5 pt-2 flex-row! gap-3 border-t-0! bg-transparent! rounded-none! m-0!">
          <button
            type="button"
            onClick={handleClose}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            style={{ minHeight: 48 }}
          >
            Cancel
          </button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 rounded-xl text-base font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-40"
            style={{ height: 50 }}
          >
            Add to Order
            {cents > 0 && (
              <span className="ml-2 opacity-90">
                <MoneyDisplay cents={cents} className="text-white" />
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { useOrderStore } from '@/stores/order-store'
import { REFIRE_REASONS } from '@/lib/constants'
import type { RefireReason } from '@/lib/constants'
import {
  Minus,
  Plus,
  X,
  XCircle,
  Gift,
  RotateCcw,
  MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface OrderModifier {
  id: string
  modifier_id: string
  name: string
  price_cents: number
  quantity: number
}

interface ItemData {
  id: string
  menu_item_id: string
  name: string
  price_cents: number
  quantity: number
  modifiers: OrderModifier[]
  special_instructions: string
  status: 'pending' | 'sent' | 'fired' | 'ready' | 'served' | 'voided'
  voided: boolean
}

interface ItemEditPopoverProps {
  item: ItemData
  anchorRect: DOMRect | null
  onClose: () => void
  onVoid: (itemId: string, itemName: string, isSent: boolean) => void
  onComp: (itemId: string, itemName: string, priceCents: number) => void
}

const QUICK_MODS = [
  { label: 'No Onions', value: 'No onions' },
  { label: 'No Dairy', value: 'No dairy' },
  { label: 'No Gluten', value: 'No gluten' },
  { label: 'Extra Sauce', value: 'Extra sauce' },
  { label: 'On Side', value: 'On the side' },
  { label: 'Well Done', value: 'Well done' },
  { label: 'Rare', value: 'Rare' },
  { label: 'Spicy', value: 'Spicy' },
  { label: 'No Salt', value: 'No salt' },
  { label: 'Sub GF', value: 'Sub gluten-free' },
  { label: 'Allergy', value: '⚠️ ALLERGY' },
  { label: 'Light', value: 'Light' },
]

/**
 * Popover that appears when tapping an item in the order list.
 * Shows quantity stepper, modifier list, special instructions, and action buttons.
 * Positioned to the right of the tapped item, flipping left if needed.
 */
export function ItemEditPopover({
  item,
  anchorRect,
  onClose,
  onVoid,
  onComp,
}: ItemEditPopoverProps) {
  const {
    updateItemQuantity,
    updateItemModifiers,
    updateItemSpecialInstructions,
    removeItem,
  } = useOrderStore((s) => s.actions)
  const currentOrder = useOrderStore((s) => s.currentOrder)

  const [localInstructions, setLocalInstructions] = useState(item.special_instructions)
  const [showRefireMenu, setShowRefireMenu] = useState(false)
  const [isRefiring, setIsRefiring] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Delay to avoid the same click that opened this
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick)
    }, 50)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [onClose])

  // Close on escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Toggle a quick mod chip in/out of special instructions
  const toggleQuickMod = useCallback((modValue: string) => {
    setLocalInstructions(prev => {
      if (prev.toLowerCase().includes(modValue.toLowerCase())) {
        const parts = prev.split(', ').filter(p => p.toLowerCase() !== modValue.toLowerCase())
        const result = parts.join(', ')
        updateItemSpecialInstructions(item.id, result)
        return result
      } else {
        const result = prev ? `${prev}, ${modValue}` : modValue
        updateItemSpecialInstructions(item.id, result)
        return result
      }
    })
  }, [item.id, updateItemSpecialInstructions])

  // Save instructions on blur
  const handleInstructionsBlur = useCallback(() => {
    if (localInstructions !== item.special_instructions) {
      updateItemSpecialInstructions(item.id, localInstructions)
    }
  }, [localInstructions, item.id, item.special_instructions, updateItemSpecialInstructions])

  // Quantity controls
  const handleDecrement = useCallback(() => {
    if (item.quantity <= 1) {
      removeItem(item.id)
      onClose()
    } else {
      updateItemQuantity(item.id, item.quantity - 1)
    }
  }, [item.id, item.quantity, updateItemQuantity, removeItem, onClose])

  const handleIncrement = useCallback(() => {
    updateItemQuantity(item.id, item.quantity + 1)
  }, [item.id, item.quantity, updateItemQuantity])

  // Remove a modifier
  const handleRemoveModifier = useCallback(
    (modId: string) => {
      const newMods = item.modifiers.filter((m) => m.id !== modId)
      updateItemModifiers(item.id, newMods)
    },
    [item.id, item.modifiers, updateItemModifiers]
  )

  // Re-fire
  const handleRefire = useCallback(
    async (reason: RefireReason) => {
      if (!currentOrder) return
      setIsRefiring(true)
      try {
        const res = await fetch(
          `/api/orders/${currentOrder.id}/items/${item.id}/refire`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
          }
        )
        if (res.ok) {
          toast.success(`Re-fired: ${item.name}`, {
            description: REFIRE_REASONS.find((r) => r.value === reason)?.label,
          })
          setShowRefireMenu(false)
          onClose()
        } else {
          toast.error('Failed to re-fire item')
        }
      } catch {
        toast.error('Network error - could not re-fire')
      } finally {
        setIsRefiring(false)
      }
    },
    [currentOrder, item.id, item.name, onClose]
  )

  // Compute item total
  const itemTotal =
    item.price_cents * item.quantity +
    item.modifiers.reduce((s, m) => s + m.price_cents * m.quantity, 0)

  // Position the popover
  // We want it anchored near the item, fitting within the viewport
  const popoverStyle: React.CSSProperties = {}
  if (anchorRect) {
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024
    const popoverWidth = 320
    // Try to position to the right of the anchor
    const rightX = anchorRect.right + 8
    const leftX = anchorRect.left - popoverWidth - 8

    if (rightX + popoverWidth < viewportWidth) {
      popoverStyle.left = rightX
    } else if (leftX > 0) {
      popoverStyle.left = leftX
    } else {
      // Center horizontally if neither side works
      popoverStyle.left = Math.max(8, (viewportWidth - popoverWidth) / 2)
    }

    // Vertical: center on the anchor, clamped to viewport
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 768
    const estimatedHeight = 400
    let topY = anchorRect.top + anchorRect.height / 2 - estimatedHeight / 2
    topY = Math.max(8, Math.min(topY, viewportHeight - estimatedHeight - 8))
    popoverStyle.top = topY
  }

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 animate-fade-in"
      style={{
        ...popoverStyle,
        width: 320,
      }}
    >
      <div
        className="rounded-2xl bg-white overflow-hidden"
        style={{
          boxShadow:
            '0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',
          border: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '0.5px solid var(--separator)' }}
        >
          <div className="flex-1 min-w-0">
            <h3 className="text-headline font-bold text-foreground truncate">
              {item.name}
            </h3>
            <MoneyDisplay
              cents={itemTotal}
              className="text-subhead text-muted-foreground"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-press flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-[var(--secondary)] transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-3 space-y-4">
          {/* Quantity stepper */}
          <div className="flex items-center justify-between">
            <span className="text-subhead font-medium text-muted-foreground">
              Quantity
            </span>
            <div className="flex items-center gap-1 rounded-xl border border-border bg-white p-0.5">
              <button
                type="button"
                onClick={handleDecrement}
                className="btn-press flex items-center justify-center rounded-lg hover:bg-[var(--muted)] transition-colors"
                style={{ width: 48, height: 48 }}
              >
                <Minus className="h-5 w-5" />
              </button>
              <span className="tabular-nums text-headline font-bold w-10 text-center">
                {item.quantity}
              </span>
              <button
                type="button"
                onClick={handleIncrement}
                className="btn-press flex items-center justify-center rounded-lg hover:bg-[var(--muted)] transition-colors"
                style={{ width: 48, height: 48 }}
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Modifiers */}
          {item.modifiers.length > 0 && (
            <div>
              <span className="text-subhead font-medium text-muted-foreground mb-2 block">
                Modifiers
              </span>
              <div className="space-y-1">
                {item.modifiers.map((mod) => (
                  <div
                    key={mod.id}
                    className="flex items-center gap-2 rounded-lg bg-[var(--secondary)] px-3 py-2"
                  >
                    <span className="flex-1 text-subhead text-foreground">
                      {mod.name}
                    </span>
                    {mod.price_cents !== 0 && (
                      <MoneyDisplay
                        cents={mod.price_cents}
                        showSign
                        className="text-footnote text-muted-foreground"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveModifier(mod.id)}
                      className="btn-press flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-red-50 transition-colors"
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Mods */}
          <div>
            <span className="text-subhead font-medium text-muted-foreground mb-2 block">
              Quick Mods
            </span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_MODS.map((mod) => {
                const isActive = localInstructions.toLowerCase().includes(mod.value.toLowerCase())
                return (
                  <button
                    key={mod.value}
                    type="button"
                    onClick={() => toggleQuickMod(mod.value)}
                    className={cn(
                      'btn-press rounded-lg px-2.5 py-1.5 text-caption-1 font-semibold transition-all',
                      isActive
                        ? 'bg-[var(--color-primary)] text-white shadow-sm'
                        : 'bg-[var(--secondary)] text-foreground hover:bg-[var(--muted)]',
                      mod.label === 'Allergy' && !isActive && 'bg-red-50 text-red-600 hover:bg-red-100',
                      mod.label === 'Allergy' && isActive && 'bg-red-500 text-white',
                    )}
                  >
                    {mod.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Special instructions */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-subhead font-medium text-muted-foreground">
                Special Instructions
              </span>
            </div>
            <textarea
              value={localInstructions}
              onChange={(e) => setLocalInstructions(e.target.value)}
              onBlur={handleInstructionsBlur}
              placeholder="e.g. No onions, extra sauce..."
              maxLength={200}
              className="w-full rounded-xl border border-border bg-[var(--secondary)] px-3 py-2.5 text-subhead text-foreground placeholder:text-muted-foreground/50 resize-none focus:ring-2 focus:ring-[var(--ring)]/20 focus:outline-none transition-all"
              rows={2}
            />
            <p className="mt-0.5 text-right text-caption-2 text-muted-foreground">
              {localInstructions.length}/200
            </p>
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '0.5px solid var(--separator)' }} />

        {/* Re-fire reason picker */}
        {showRefireMenu && (
          <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--separator)' }}>
            <span className="text-subhead font-medium text-muted-foreground mb-2 block">
              Re-fire Reason
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {REFIRE_REASONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleRefire(value as RefireReason)}
                  disabled={isRefiring}
                  className="btn-press rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-footnote font-medium text-foreground hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 px-4 py-3">
          {/* Void */}
          <button
            type="button"
            onClick={() => {
              onVoid(item.id, item.name, item.status !== 'pending')
              onClose()
            }}
            className="btn-press flex h-11 items-center gap-1.5 rounded-xl bg-red-50 px-3 text-footnote font-bold text-red-600 hover:bg-red-100 transition-colors"
          >
            <XCircle className="h-4 w-4" />
            Void
          </button>

          {/* Comp */}
          <button
            type="button"
            onClick={() => {
              onComp(item.id, item.name, itemTotal)
              onClose()
            }}
            className="btn-press flex h-11 items-center gap-1.5 rounded-xl bg-amber-50 px-3 text-footnote font-bold text-amber-600 hover:bg-amber-100 transition-colors"
          >
            <Gift className="h-4 w-4" />
            Comp
          </button>

          {/* Re-fire */}
          <button
            type="button"
            onClick={() => setShowRefireMenu(!showRefireMenu)}
            className={cn(
              'btn-press flex h-11 items-center gap-1.5 rounded-xl px-3 text-footnote font-bold transition-colors',
              showRefireMenu
                ? 'bg-[var(--primary)] text-white'
                : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
            )}
          >
            <RotateCcw className="h-4 w-4" />
            Re-fire
          </button>
        </div>
      </div>
    </div>
  )
}

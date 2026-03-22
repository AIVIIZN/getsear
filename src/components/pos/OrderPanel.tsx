'use client'

import { useCallback, useRef, useEffect, useState } from 'react'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { OrderTypeChips } from './OrderTypeChips'
import { GuestCountPicker } from './GuestCountPicker'
import { SeatSelector } from './SeatSelector'
import { useOrderStore } from '@/stores/order-store'
import { Minus, Plus, ArrowRight, UtensilsCrossed, Send } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OrderPanelProps {
  onSendToKitchen: () => void
  isSending: boolean
}

export function OrderPanel({ onSendToKitchen, isSending }: OrderPanelProps) {
  const currentOrder = useOrderStore((s) => s.currentOrder)
  const activeSeat = useOrderStore((s) => s.activeSeat)
  const {
    setOrderType,
    setGuestCount,
    setActiveSeat,
    updateItemQuantity,
    removeItem,
  } = useOrderStore((s) => s.actions)

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [flashId, setFlashId] = useState<string | null>(null)
  const itemListRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new item added
  const prevItemCount = useRef(currentOrder?.items.length ?? 0)
  useEffect(() => {
    const count = currentOrder?.items.length ?? 0
    if (count > prevItemCount.current && itemListRef.current) {
      itemListRef.current.scrollTop = itemListRef.current.scrollHeight
      // Flash the last added item
      const lastItem = currentOrder?.items[count - 1]
      if (lastItem) {
        setFlashId(lastItem.id)
        setTimeout(() => setFlashId(null), 500)
      }
    }
    prevItemCount.current = count
  }, [currentOrder?.items.length, currentOrder?.items])

  const filteredItems = currentOrder?.items.filter((item) => {
    if (activeSeat === null) return true
    return item.seat_number === activeSeat
  }) ?? []

  const handleQuantityChange = useCallback(
    (itemId: string, currentQty: number, delta: number) => {
      const newQty = currentQty + delta
      if (newQty <= 0) {
        removeItem(itemId)
      } else {
        updateItemQuantity(itemId, newQty)
      }
    },
    [updateItemQuantity, removeItem]
  )

  const hasUnsentItems = currentOrder?.items.some(
    (i) => !i.voided && i.status === 'pending'
  ) ?? false

  if (!currentOrder) {
    return (
      <div className="flex w-[var(--order-panel-width)] flex-col border-r border-border bg-white">
        <EmptyState
          icon={UtensilsCrossed}
          title="No Active Order"
          description="Start a new order or select an existing one from the checks list."
        />
      </div>
    )
  }

  return (
    <div className="flex w-[var(--order-panel-width)] flex-col border-r border-border bg-white">
      {/* Header */}
      <div className="shrink-0 space-y-3 border-b border-border px-3 py-3">
        {/* Order type chips */}
        <OrderTypeChips
          value={currentOrder.order_type}
          onChange={(type) => setOrderType(type)}
        />

        {/* Order number + status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {currentOrder.order_number && (
              <span className="text-sm font-bold text-foreground">
                #{currentOrder.order_number}
              </span>
            )}
            {currentOrder.table_name && (
              <span className="rounded-md bg-[var(--info-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--info)]">
                {currentOrder.table_name}
              </span>
            )}
          </div>
          <StatusBadge status={currentOrder.status} />
        </div>

        {/* Guest count */}
        <GuestCountPicker
          count={currentOrder.guest_count}
          onChange={setGuestCount}
        />

        {/* Seat selector */}
        <SeatSelector
          guestCount={currentOrder.guest_count}
          activeSeat={activeSeat}
          onSelect={setActiveSeat}
        />
      </div>

      {/* Item list — scrollable middle */}
      <div ref={itemListRef} className="flex-1 overflow-y-auto scrollbar-hide">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center">
            <ArrowRight className="h-8 w-8 text-muted-foreground/40 mb-3 rotate-0" />
            <p className="text-sm font-medium text-muted-foreground">
              Tap a menu item to start
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  setSelectedItemId(selectedItemId === item.id ? null : item.id)
                }
                className={cn(
                  'w-full text-left px-3 py-2.5 transition-colors duration-150',
                  item.voided && 'opacity-50',
                  selectedItemId === item.id && 'bg-[var(--accent)]',
                  flashId === item.id && 'animate-item-flash'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          'text-sm font-medium text-foreground truncate',
                          item.voided && 'line-through'
                        )}
                      >
                        {item.name}
                      </span>
                      {item.voided && (
                        <span className="shrink-0 rounded bg-[var(--error-bg)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--error)]">
                          VOID
                        </span>
                      )}
                      {item.seat_number && (
                        <span className="shrink-0 rounded bg-[var(--muted)] px-1 py-0.5 text-[10px] font-medium text-muted-foreground">
                          S{item.seat_number}
                        </span>
                      )}
                    </div>

                    {/* Modifiers */}
                    {item.modifiers.length > 0 && (
                      <div className="mt-0.5">
                        {item.modifiers.map((mod) => (
                          <span
                            key={mod.id}
                            className="text-xs text-muted-foreground"
                          >
                            {mod.name}
                            {mod.price_cents !== 0 && (
                              <> (+<MoneyDisplay cents={mod.price_cents} className="text-xs" />)</>
                            )}
                            {', '}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Special instructions */}
                    {item.special_instructions && (
                      <p className="mt-0.5 text-xs italic text-muted-foreground truncate">
                        {item.special_instructions}
                      </p>
                    )}
                  </div>

                  {/* Price */}
                  <MoneyDisplay
                    cents={item.price_cents * item.quantity + item.modifiers.reduce((s, m) => s + m.price_cents * m.quantity, 0)}
                    className={cn(
                      'text-sm font-semibold shrink-0',
                      item.voided ? 'line-through text-muted-foreground' : 'text-foreground'
                    )}
                  />
                </div>

                {/* Quantity stepper */}
                {!item.voided && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleQuantityChange(item.id, item.quantity, -1)
                      }}
                      className="btn-press flex h-7 w-7 items-center justify-center rounded-md border border-border bg-white hover:bg-[var(--muted)] transition-colors"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="tabular-nums text-xs font-semibold w-5 text-center">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleQuantityChange(item.id, item.quantity, 1)
                      }}
                      className="btn-press flex h-7 w-7 items-center justify-center rounded-md border border-border bg-white hover:bg-[var(--muted)] transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Totals footer — sticky at bottom */}
      <div className="shrink-0 border-t border-border bg-white px-3 py-3 space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <MoneyDisplay cents={currentOrder.subtotal_cents} className="font-medium" />
        </div>
        {currentOrder.discount_cents > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--success)]">Discount</span>
            <MoneyDisplay
              cents={-currentOrder.discount_cents}
              className="font-medium text-[var(--success)]"
            />
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Tax</span>
          <MoneyDisplay cents={currentOrder.tax_cents} className="font-medium" />
        </div>
        <div className="flex items-center justify-between border-t border-border pt-2">
          <span className="text-base font-bold text-foreground">Total</span>
          <MoneyDisplay
            cents={currentOrder.total_cents}
            className="text-lg font-bold text-foreground"
          />
        </div>

        {/* Send to Kitchen button */}
        <button
          type="button"
          onClick={onSendToKitchen}
          disabled={isSending || !hasUnsentItems}
          className={cn(
            'btn-press touch-target-lg mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold transition-all duration-150',
            hasUnsentItems
              ? 'bg-[var(--primary)] text-white shadow-warm-md hover:bg-[var(--primary-hover)] active:bg-[var(--primary-active)]'
              : 'bg-[var(--muted)] text-[var(--muted-foreground)] cursor-not-allowed'
          )}
        >
          <Send className="h-5 w-5" />
          {isSending ? 'Sending...' : 'Send to Kitchen'}
        </button>
      </div>
    </div>
  )
}

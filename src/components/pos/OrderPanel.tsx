'use client'

import { useCallback, useRef, useEffect, useState } from 'react'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { OrderTypeChips } from './OrderTypeChips'
import { GuestCountPicker } from './GuestCountPicker'
import { SeatSelector } from './SeatSelector'
import { CourseSelector } from './CourseSelector'
import { useOrderStore } from '@/stores/order-store'
import { Minus, Plus, ArrowRight, UtensilsCrossed, Send, CreditCard, XCircle, Gift } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OrderPanelProps {
  onSendToKitchen: () => void
  isSending: boolean
  onItemVoid?: (itemId: string, itemName: string, isSent: boolean) => void
  onItemComp?: (itemId: string, itemName: string, priceCents: number) => void
  onGoToPayment?: () => void
}

export function OrderPanel({ onSendToKitchen, isSending, onItemVoid, onItemComp, onGoToPayment }: OrderPanelProps) {
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

  const hasItems = (currentOrder?.items.filter((i) => !i.voided).length ?? 0) > 0

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
      {/* Header — compact, organized */}
      <div className="shrink-0 border-b border-border">
        {/* Order type + status bar */}
        <div className="flex items-center justify-between px-3 pt-3 pb-1">
          <div className="flex items-center gap-2">
            {currentOrder.order_number ? (
              <span className="text-base font-black text-foreground tracking-tight">
                #{currentOrder.order_number}
              </span>
            ) : (
              <span className="text-xs font-medium text-muted-foreground bg-[var(--muted)] px-2 py-0.5 rounded-md">
                New Order
              </span>
            )}
            {currentOrder.table_name && (
              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
                {currentOrder.table_name}
              </span>
            )}
          </div>
          <StatusBadge status={currentOrder.status} />
        </div>

        {/* Order type chips */}
        <div className="px-3 pb-2">
          <OrderTypeChips
            value={currentOrder.order_type}
            onChange={(type) => setOrderType(type)}
          />
        </div>

        {/* Guest count + Course selector */}
        <div className="flex items-center gap-3 px-3 pb-2">
          <GuestCountPicker
            count={currentOrder.guest_count}
            onChange={setGuestCount}
          />
          <div className="h-4 w-px bg-border" />
          <CourseSelector />
        </div>

        {/* Seat selector */}
        <div className="px-3 pb-2.5">
          <SeatSelector
            guestCount={currentOrder.guest_count}
            activeSeat={activeSeat}
            onSelect={setActiveSeat}
          />
        </div>
      </div>

      {/* Item list — scrollable middle */}
      <div ref={itemListRef} className="flex-1 overflow-y-auto scrollbar-hide">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center">
            <ArrowRight className="h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground/60">
              Tap a menu item to start
            </p>
          </div>
        ) : (
          <div className="py-1">
            {filteredItems.map((item) => {
              const itemTotal = item.price_cents * item.quantity + item.modifiers.reduce((s, m) => s + m.price_cents * m.quantity, 0)
              const isSelected = selectedItemId === item.id

              return (
                <div
                  key={item.id}
                  className={cn(
                    'relative mx-1.5 mb-1 rounded-xl transition-all duration-150',
                    item.voided && 'opacity-40',
                    isSelected && 'bg-[var(--accent)] shadow-warm-sm',
                    flashId === item.id && 'animate-item-flash',
                    !isSelected && !item.voided && 'hover:bg-[var(--secondary)]'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedItemId(isSelected ? null : item.id)}
                    className="w-full text-left px-3 py-2.5"
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Quantity badge */}
                      {!item.voided && (
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--secondary)] text-xs font-bold text-foreground">
                          {item.quantity}
                        </span>
                      )}

                      <div className="flex-1 min-w-0">
                        {/* Item name + badges */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={cn(
                              'text-[15px] font-semibold leading-tight text-foreground',
                              item.voided && 'line-through text-muted-foreground'
                            )}
                          >
                            {item.name}
                          </span>
                          {item.voided && (
                            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                              VOID
                            </span>
                          )}
                          {item.seat_number != null && (
                            <span className="rounded bg-[var(--muted)] px-1 py-0.5 text-[10px] font-medium text-muted-foreground">
                              S{item.seat_number}
                            </span>
                          )}
                          {item.course > 1 && (
                            <span className="rounded bg-blue-50 px-1 py-0.5 text-[10px] font-medium text-blue-700">
                              C{item.course}
                            </span>
                          )}
                        </div>

                        {/* Modifiers — indented */}
                        {item.modifiers.length > 0 && (
                          <div className="mt-0.5 pl-0.5">
                            {item.modifiers.map((mod) => (
                              <p
                                key={mod.id}
                                className="text-xs text-muted-foreground leading-relaxed"
                              >
                                <span className="text-muted-foreground/40 mr-1">&bull;</span>
                                {mod.name}
                                {mod.price_cents !== 0 && (
                                  <span className="text-muted-foreground/60">
                                    {' '}(+<MoneyDisplay cents={mod.price_cents} className="text-xs" />)
                                  </span>
                                )}
                              </p>
                            ))}
                          </div>
                        )}

                        {/* Special instructions */}
                        {item.special_instructions && (
                          <p className="mt-1 text-xs italic text-amber-600 bg-amber-50 rounded px-1.5 py-0.5 inline-block">
                            {item.special_instructions}
                          </p>
                        )}
                      </div>

                      {/* Price */}
                      <MoneyDisplay
                        cents={itemTotal}
                        className={cn(
                          'text-[15px] font-semibold shrink-0 tabular-nums',
                          item.voided ? 'line-through text-muted-foreground' : 'text-foreground'
                        )}
                      />
                    </div>
                  </button>

                  {/* Expanded controls when selected */}
                  {isSelected && !item.voided && (
                    <div className="flex items-center gap-2 px-3 pb-2.5">
                      {/* Quantity stepper */}
                      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-white p-0.5">
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(item.id, item.quantity, -1)}
                          className="btn-press flex h-8 w-8 items-center justify-center rounded-md hover:bg-[var(--muted)] transition-colors"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="tabular-nums text-sm font-bold w-6 text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(item.id, item.quantity, 1)}
                          className="btn-press flex h-8 w-8 items-center justify-center rounded-md hover:bg-[var(--muted)] transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="flex-1" />

                      {/* Void button */}
                      <button
                        type="button"
                        onClick={() => onItemVoid?.(item.id, item.name, item.status !== 'pending')}
                        className="btn-press flex h-8 items-center gap-1 rounded-lg bg-red-50 px-2.5 text-xs font-bold text-red-600 hover:bg-red-100 transition-colors"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Void
                      </button>
                      {/* Comp button */}
                      <button
                        type="button"
                        onClick={() => onItemComp?.(item.id, item.name, itemTotal)}
                        className="btn-press flex h-8 items-center gap-1 rounded-lg bg-amber-50 px-2.5 text-xs font-bold text-amber-600 hover:bg-amber-100 transition-colors"
                      >
                        <Gift className="h-3.5 w-3.5" />
                        Comp
                      </button>
                    </div>
                  )}

                  {/* Hairline separator */}
                  <div className="absolute bottom-0 left-3 right-3 h-px bg-border/50" />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Totals footer */}
      <div className="shrink-0 border-t border-border bg-white">
        <div className="px-3 pt-3 pb-2 space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <MoneyDisplay cents={currentOrder.subtotal_cents} className="font-medium" />
          </div>
          {currentOrder.discount_cents > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-green-600">Discount</span>
              <MoneyDisplay cents={-currentOrder.discount_cents} className="font-medium text-green-600" />
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Tax</span>
            <MoneyDisplay cents={currentOrder.tax_cents} className="font-medium" />
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t border-border/50">
            <span className="text-lg font-black text-foreground">Total</span>
            <MoneyDisplay
              cents={currentOrder.total_cents}
              className="text-xl font-black text-foreground"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 px-3 pb-3">
          <button
            type="button"
            onClick={onSendToKitchen}
            disabled={isSending || !hasUnsentItems}
            className={cn(
              'btn-press flex h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl text-[15px] font-bold transition-all duration-150',
              hasUnsentItems
                ? 'bg-[var(--primary)] text-white shadow-[0_2px_8px_rgba(240,107,24,0.3)] hover:shadow-[0_4px_16px_rgba(240,107,24,0.4)] active:shadow-none'
                : 'bg-[var(--muted)] text-[var(--muted-foreground)] cursor-not-allowed'
            )}
          >
            <Send className="h-[18px] w-[18px]" />
            {isSending ? 'Sending...' : 'Send'}
          </button>

          {hasItems && (
            <button
              type="button"
              onClick={onGoToPayment}
              className="btn-press flex h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl text-[15px] font-bold bg-[#34C759] text-white shadow-[0_2px_8px_rgba(52,199,89,0.3)] hover:shadow-[0_4px_16px_rgba(52,199,89,0.4)] active:shadow-none transition-all duration-150"
            >
              <CreditCard className="h-[18px] w-[18px]" />
              Pay
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

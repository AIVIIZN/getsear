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
import {
  Minus,
  Plus,
  ArrowRight,
  UtensilsCrossed,
  Send,
  CreditCard,
  XCircle,
  Gift,
  MoreHorizontal,
  PauseCircle,
  Flame,
  Zap,
  Percent,
  Printer,
  ArrowRightLeft,
  MapPin,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface OrderPanelProps {
  onSendToKitchen: () => void
  isSending: boolean
  onItemVoid?: (itemId: string, itemName: string, isSent: boolean) => void
  onItemComp?: (itemId: string, itemName: string, priceCents: number) => void
  onGoToPayment?: () => void
  // Quick actions (moved from QuickActions strip)
  onHold?: () => void
  onFireCourse?: () => void
  onRush?: () => void
  onDiscount?: () => void
  onPrint?: () => void
  onVoidOrder?: () => void
  onTransfer?: () => void
  onMoveTable?: () => void
}

function ActionMenu({
  onHold,
  onFireCourse,
  onRush,
  onDiscount,
  onPrint,
  onVoidOrder,
  onTransfer,
  onMoveTable,
  disabled,
}: {
  onHold?: () => void
  onFireCourse?: () => void
  onRush?: () => void
  onDiscount?: () => void
  onPrint?: () => void
  onVoidOrder?: () => void
  onTransfer?: () => void
  onMoveTable?: () => void
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const actions = [
    { label: 'Hold Order', icon: PauseCircle, handler: onHold, color: 'text-[var(--warning)]' },
    { label: 'Fire Course', icon: Flame, handler: onFireCourse, color: 'text-[var(--primary)]' },
    { label: 'Rush', icon: Zap, handler: onRush, color: 'text-[var(--error)]' },
    { label: 'Discount', icon: Percent, handler: onDiscount, color: 'text-[var(--info)]' },
    { label: 'Print Check', icon: Printer, handler: onPrint, color: 'text-[var(--muted-foreground)]' },
    { label: 'Transfer', icon: ArrowRightLeft, handler: onTransfer, color: 'text-[var(--info)]' },
    { label: 'Move Table', icon: MapPin, handler: onMoveTable, color: 'text-[var(--success)]' },
    { label: 'Void Order', icon: XCircle, handler: onVoidOrder, color: 'text-[var(--destructive)]' },
  ]

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="btn-press touch-target flex items-center justify-center rounded-xl text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)] disabled:opacity-30"
        style={{ width: 44, height: 44, transitionDuration: 'var(--duration-fast)' }}
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-56 rounded-2xl bg-white py-2 animate-fade-in"
          style={{ boxShadow: 'var(--shadow-xl)' }}
        >
          {actions.map(({ label, icon: Icon, handler, color }) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setOpen(false)
                handler?.()
              }}
              disabled={!handler}
              className={cn(
                'row-press flex w-full items-center gap-3 px-4 py-3 text-subhead font-medium text-[var(--foreground)]',
                'disabled:opacity-30 disabled:cursor-not-allowed'
              )}
            >
              <Icon className={cn('h-5 w-5 shrink-0', color)} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function OrderPanel({
  onSendToKitchen,
  isSending,
  onItemVoid,
  onItemComp,
  onGoToPayment,
  onHold,
  onFireCourse,
  onRush,
  onDiscount,
  onPrint,
  onVoidOrder,
  onTransfer,
  onMoveTable,
}: OrderPanelProps) {
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
      <div className="flex flex-col bg-white" style={{ width: '30%', minWidth: 320, maxWidth: 400 }}>
        <EmptyState
          icon={UtensilsCrossed}
          title="No Active Order"
          description="Start a new order or select an existing one from the checks list."
        />
      </div>
    )
  }

  return (
    <div
      className="flex flex-col bg-white"
      style={{
        width: '30%',
        minWidth: 320,
        maxWidth: 400,
        borderRight: '0.5px solid var(--separator)',
      }}
    >
      {/* Header */}
      <div className="shrink-0" style={{ borderBottom: '0.5px solid var(--separator)' }}>
        {/* Order info + action menu */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="flex items-center gap-2">
            {currentOrder.order_number ? (
              <span className="text-title-3 font-black text-foreground tracking-tight">
                #{currentOrder.order_number}
              </span>
            ) : (
              <span className="text-footnote font-semibold text-muted-foreground bg-[var(--muted)] px-2.5 py-1 rounded-lg">
                New Order
              </span>
            )}
            {currentOrder.table_name && (
              <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-footnote font-bold text-blue-700">
                {currentOrder.table_name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <StatusBadge status={currentOrder.status} />
            <ActionMenu
              onHold={onHold}
              onFireCourse={onFireCourse}
              onRush={onRush}
              onDiscount={onDiscount}
              onPrint={onPrint}
              onVoidOrder={onVoidOrder}
              onTransfer={onTransfer}
              onMoveTable={onMoveTable}
              disabled={!currentOrder}
            />
          </div>
        </div>

        {/* Order type chips */}
        <div className="px-4 pb-2">
          <OrderTypeChips
            value={currentOrder.order_type}
            onChange={(type) => setOrderType(type)}
          />
        </div>

        {/* Guest count + Course selector */}
        <div className="flex items-center gap-3 px-4 pb-2">
          <GuestCountPicker
            count={currentOrder.guest_count}
            onChange={setGuestCount}
          />
          <div className="h-4 w-px" style={{ backgroundColor: 'var(--separator)' }} />
          <CourseSelector />
        </div>

        {/* Seat selector */}
        <div className="px-4 pb-3">
          <SeatSelector
            guestCount={currentOrder.guest_count}
            activeSeat={activeSeat}
            onSelect={setActiveSeat}
          />
        </div>
      </div>

      {/* Item list — scrollable middle */}
      <div ref={itemListRef} className="flex-1 overflow-y-auto scrollbar-hide scroll-container">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center">
            <ArrowRight className="h-10 w-10 text-muted-foreground/20 mb-3" />
            <p className="text-callout font-medium text-muted-foreground/50">
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
                    'relative mx-2 mb-1 rounded-xl transition-all duration-150',
                    item.voided && 'opacity-40',
                    isSelected && 'bg-[var(--info)]/[0.06] ring-1 ring-[var(--info)]/20',
                    flashId === item.id && 'animate-item-flash',
                    !isSelected && !item.voided && 'hover:bg-[var(--secondary)]'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedItemId(isSelected ? null : item.id)}
                    className="w-full text-left px-3 py-3"
                  >
                    <div className="flex items-start gap-3">
                      {/* Quantity badge */}
                      {!item.voided && (
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--secondary)] text-footnote font-bold text-foreground">
                          {item.quantity}
                        </span>
                      )}

                      <div className="flex-1 min-w-0">
                        {/* Item name + badges */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={cn(
                              'text-headline leading-tight text-foreground',
                              item.voided && 'line-through text-muted-foreground'
                            )}
                          >
                            {item.name}
                          </span>
                          {item.voided && (
                            <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-caption-2 font-bold text-red-600">
                              VOID
                            </span>
                          )}
                          {item.seat_number != null && (
                            <span className="rounded-md bg-[var(--muted)] px-1.5 py-0.5 text-caption-2 font-medium text-muted-foreground">
                              S{item.seat_number}
                            </span>
                          )}
                          {item.course > 1 && (
                            <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-caption-2 font-medium text-blue-700">
                              C{item.course}
                            </span>
                          )}
                        </div>

                        {/* Modifiers — indented, readable */}
                        {item.modifiers.length > 0 && (
                          <div className="mt-1 pl-1">
                            {item.modifiers.map((mod) => (
                              <p
                                key={mod.id}
                                className="text-subhead text-muted-foreground leading-relaxed"
                              >
                                <span className="text-muted-foreground/40 mr-1.5">&bull;</span>
                                {mod.name}
                                {mod.price_cents !== 0 && (
                                  <span className="text-muted-foreground/60">
                                    {' '}(+<MoneyDisplay cents={mod.price_cents} className="text-subhead" />)
                                  </span>
                                )}
                              </p>
                            ))}
                          </div>
                        )}

                        {/* Special instructions */}
                        {item.special_instructions && (
                          <p className="mt-1.5 text-footnote italic text-amber-700 bg-amber-50 rounded-lg px-2 py-1 inline-block">
                            {item.special_instructions}
                          </p>
                        )}
                      </div>

                      {/* Price */}
                      <MoneyDisplay
                        cents={itemTotal}
                        className={cn(
                          'text-headline shrink-0 tabular-nums',
                          item.voided ? 'line-through text-muted-foreground' : 'text-foreground'
                        )}
                      />
                    </div>
                  </button>

                  {/* Expanded controls when selected */}
                  {isSelected && !item.voided && (
                    <div className="flex items-center gap-2 px-3 pb-3">
                      {/* Quantity stepper */}
                      <div className="flex items-center gap-1 rounded-xl border border-border bg-white p-0.5">
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(item.id, item.quantity, -1)}
                          className="btn-press flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[var(--muted)] transition-colors"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="tabular-nums text-subhead font-bold w-7 text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(item.id, item.quantity, 1)}
                          className="btn-press flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[var(--muted)] transition-colors"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex-1" />

                      {/* Void button */}
                      <button
                        type="button"
                        onClick={() => onItemVoid?.(item.id, item.name, item.status !== 'pending')}
                        className="btn-press flex h-9 items-center gap-1.5 rounded-xl bg-red-50 px-3 text-footnote font-bold text-red-600 hover:bg-red-100 transition-colors"
                      >
                        <XCircle className="h-4 w-4" />
                        Void
                      </button>
                      {/* Comp button */}
                      <button
                        type="button"
                        onClick={() => onItemComp?.(item.id, item.name, itemTotal)}
                        className="btn-press flex h-9 items-center gap-1.5 rounded-xl bg-amber-50 px-3 text-footnote font-bold text-amber-600 hover:bg-amber-100 transition-colors"
                      >
                        <Gift className="h-4 w-4" />
                        Comp
                      </button>
                    </div>
                  )}

                  {/* Hairline separator */}
                  <div
                    className="absolute bottom-0 left-4 right-4"
                    style={{ borderBottom: '0.5px solid var(--separator)', opacity: 0.5 }}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Totals footer */}
      <div className="shrink-0 bg-white" style={{ borderTop: '0.5px solid var(--separator)' }}>
        <div className="px-4 pt-3 pb-2 space-y-1.5">
          <div className="flex items-center justify-between text-subhead">
            <span className="text-muted-foreground">Subtotal</span>
            <MoneyDisplay cents={currentOrder.subtotal_cents} className="font-medium tabular-nums" />
          </div>
          {currentOrder.discount_cents > 0 && (
            <div className="flex items-center justify-between text-subhead">
              <span className="text-[var(--success)]">Discount</span>
              <MoneyDisplay cents={-currentOrder.discount_cents} className="font-medium text-[var(--success)] tabular-nums" />
            </div>
          )}
          <div className="flex items-center justify-between text-subhead">
            <span className="text-muted-foreground">Tax</span>
            <MoneyDisplay cents={currentOrder.tax_cents} className="font-medium tabular-nums" />
          </div>
          <div
            className="flex items-center justify-between pt-2"
            style={{ borderTop: '0.5px solid var(--separator)' }}
          >
            <span className="text-title-2 font-black text-foreground">Total</span>
            <MoneyDisplay
              cents={currentOrder.total_cents}
              className="text-title-2 font-black text-foreground tabular-nums"
            />
          </div>
        </div>

        {/* Action buttons — 56px tall per spec */}
        <div className="flex gap-2 px-4 pb-4">
          <button
            type="button"
            onClick={onSendToKitchen}
            disabled={isSending || !hasUnsentItems}
            className={cn(
              'btn-press touch-target-xl flex flex-1 items-center justify-center gap-2 rounded-2xl text-headline transition-all duration-150',
              hasUnsentItems
                ? 'bg-[var(--primary)] text-white shadow-[0_2px_8px_rgba(240,107,24,0.3)] hover:shadow-[0_4px_16px_rgba(240,107,24,0.4)] active:shadow-none'
                : 'bg-[var(--muted)] text-[var(--muted-foreground)] cursor-not-allowed'
            )}
            style={{ height: 56 }}
          >
            <Send className="h-5 w-5" />
            {isSending ? 'Sending...' : 'Send'}
          </button>

          {hasItems && (
            <button
              type="button"
              onClick={onGoToPayment}
              className="btn-press touch-target-xl flex flex-1 items-center justify-center gap-2 rounded-2xl text-headline bg-[var(--success)] text-white shadow-[0_2px_8px_rgba(52,199,89,0.3)] hover:shadow-[0_4px_16px_rgba(52,199,89,0.4)] active:shadow-none transition-all duration-150"
              style={{ height: 56 }}
            >
              <CreditCard className="h-5 w-5" />
              Pay
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

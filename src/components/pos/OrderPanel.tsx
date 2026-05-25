'use client'

import { useCallback, useRef, useEffect, useState, useMemo } from 'react'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { OrderTypeChips } from './OrderTypeChips'
import { GuestCountPicker } from './GuestCountPicker'
import { SeatSelector } from './SeatSelector'
import { CourseSelector } from './CourseSelector'
import { ForHereToGoToggle } from './ForHereToGoToggle'
import { ItemEditPopover } from './ItemEditPopover'
import { GuestAttachmentCard } from './GuestAttachmentCard'
import { useOrderStore } from '@/stores/order-store'
import { mutateOrder, StaleOrderError } from '@/lib/orders/api-client'
import { getSeatColor } from '@/lib/constants'
import type { CourseState } from '@/lib/constants'
import {
  ArrowRight,
  UtensilsCrossed,
  Send,
  CreditCard,
  MoreHorizontal,
  PauseCircle,
  Flame,
  Zap,
  Percent,
  Printer,
  ArrowRightLeft,
  MapPin,
  XCircle,
  Circle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { AnimatePresence, motion } from 'framer-motion'
import { itemSpawn, useReducedMotion } from '@/lib/motion/transitions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrderPanelProps {
  onSendToKitchen: () => void
  isSending: boolean
  onItemVoid?: (itemId: string, itemName: string, isSent: boolean) => void
  onItemComp?: (itemId: string, itemName: string, priceCents: number) => void
  onGoToPayment?: () => void
  onHold?: () => void
  onFireCourse?: () => void
  onRush?: () => void
  onDiscount?: () => void
  onPrint?: () => void
  onVoidOrder?: () => void
  onTransfer?: () => void
  onMoveTable?: () => void
}

interface OrderItemShape {
  id: string
  menu_item_id: string
  name: string
  price_cents: number
  quantity: number
  seat_number: number | null
  course: number
  status: 'pending' | 'sent' | 'fired' | 'ready' | 'served' | 'voided'
  modifiers: { id: string; modifier_id: string; name: string; price_cents: number; quantity: number }[]
  special_instructions: string
  voided: boolean
  void_reason: string | null
}

// ---------------------------------------------------------------------------
// Grouped item structure: Seat -> Course -> Items
// ---------------------------------------------------------------------------

interface CourseGroup {
  course: number
  items: OrderItemShape[]
}

interface SeatGroup {
  seatNumber: number | null
  courseGroups: CourseGroup[]
}

function buildSeatCourseGroups(items: OrderItemShape[]): SeatGroup[] {
  // Group by seat
  const seatMap = new Map<number | null, OrderItemShape[]>()
  for (const item of items) {
    const key = item.seat_number
    const list = seatMap.get(key)
    if (list) {
      list.push(item)
    } else {
      seatMap.set(key, [item])
    }
  }

  // Sort seats: null first, then ascending
  const sortedSeats = [...seatMap.keys()].sort((a, b) => {
    if (a === null) return -1
    if (b === null) return 1
    return a - b
  })

  return sortedSeats.map((seatNumber) => {
    const seatItems = seatMap.get(seatNumber) ?? []
    // Group by course within seat
    const courseMap = new Map<number, OrderItemShape[]>()
    for (const item of seatItems) {
      const list = courseMap.get(item.course)
      if (list) {
        list.push(item)
      } else {
        courseMap.set(item.course, [item])
      }
    }
    const sortedCourses = [...courseMap.keys()].sort((a, b) => a - b)
    return {
      seatNumber,
      courseGroups: sortedCourses.map((course) => ({
        course,
        items: courseMap.get(course) ?? [],
      })),
    }
  })
}

// ---------------------------------------------------------------------------
// ActionMenu (overflow actions)
// ---------------------------------------------------------------------------

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
          className="absolute right-0 top-full z-50 mt-1 w-56 rounded-2xl bg-[var(--card)] py-2 animate-fade-in"
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

// ---------------------------------------------------------------------------
// Course Header with FIRE / HOLD toggle
// ---------------------------------------------------------------------------

function CourseHeader({
  course,
  courseState,
  onToggle,
}: {
  course: number
  courseState: CourseState
  onToggle: (course: number) => void
}) {
  const isFired = courseState === 'fire'

  return (
    <div className="flex items-center justify-between px-4 py-1.5">
      <span className="text-caption-1 font-bold text-muted-foreground uppercase tracking-wide">
        Course {course}
      </span>
      <button
        type="button"
        onClick={() => onToggle(course)}
        className={cn(
          'btn-press flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-caption-1 font-bold transition-all duration-150',
          isFired
            ? 'bg-green-50 text-green-700 hover:bg-green-100'
            : 'bg-[var(--secondary)] text-muted-foreground hover:bg-[var(--muted)]'
        )}
      >
        <Circle
          className="h-2 w-2"
          style={{
            fill: isFired ? 'var(--color-success-strong)' : 'var(--color-text-muted)',
            color: isFired ? 'var(--color-success-strong)' : 'var(--color-text-muted)',
          }}
        />
        {isFired ? 'FIRE' : 'HOLD'}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main OrderPanel
// ---------------------------------------------------------------------------

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
  const courseStates = useOrderStore((s) => s.courseStates)
  const {
    setOrderType,
    setGuestCount,
    setActiveSeat,
    setForHere,
    setCourseState,
    setCurrentOrderVersion,
    attachGuest,
    updateCurrentOrderTotals,
  } = useOrderStore((s) => s.actions)

  // Popover state
  const [editItemId, setEditItemId] = useState<string | null>(null)
  const [editAnchorRect, setEditAnchorRect] = useState<DOMRect | null>(null)
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

  // Filter items by active seat
  const filteredItems = useMemo(() => {
    return currentOrder?.items.filter((item) => {
      if (activeSeat === null) return true
      return item.seat_number === activeSeat
    }) ?? []
  }, [currentOrder?.items, activeSeat])

  // Build grouped structure: Seat -> Course -> Items
  const seatGroups = useMemo(() => buildSeatCourseGroups(filteredItems), [filteredItems])

  // Determine if there are multiple seats to show seat headers
  const hasMultipleSeats = useMemo(() => {
    const seatSet = new Set(filteredItems.map((i) => i.seat_number))
    return seatSet.size > 1
  }, [filteredItems])

  // Determine if there are multiple courses to show course headers
  const hasMultipleCourses = useMemo(() => {
    const courseSet = new Set(filteredItems.map((i) => i.course))
    return courseSet.size > 1
  }, [filteredItems])

  // Handle item tap for popover
  const handleItemTap = useCallback((itemId: string, e: React.MouseEvent) => {
    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    if (editItemId === itemId) {
      setEditItemId(null)
      setEditAnchorRect(null)
    } else {
      setEditItemId(itemId)
      setEditAnchorRect(rect)
    }
  }, [editItemId])

  const handleClosePopover = useCallback(() => {
    setEditItemId(null)
    setEditAnchorRect(null)
  }, [])

  // Course fire/hold toggle. V5.4.1: routed through `mutateOrder` so the
  // optimistic-lock `If-Match` header is sent and a 409 stale-conflict
  // surfaces the StaleOrderModal automatically.
  const handleCourseToggle = useCallback(
    async (course: number) => {
      const currentState = courseStates[course] ?? (course === 1 ? 'fire' : 'hold')
      const newState: CourseState = currentState === 'fire' ? 'hold' : 'fire'
      // Optimistic update
      setCourseState(course, newState)

      if (!currentOrder) return

      const url = newState === 'fire'
        ? `/api/orders/${currentOrder.id}/fire-course`
        : `/api/orders/${currentOrder.id}/hold`

      try {
        const result = await mutateOrder(url, currentOrder.id, {
          method: 'POST',
          body: { course },
          ifMatchVersion: currentOrder.version ?? null,
        })
        if (result.newVersion !== null) {
          setCurrentOrderVersion(result.newVersion)
        }
        if (newState === 'fire') {
          toast.success(`Course ${course} fired`)
        } else {
          toast.info(`Course ${course} held`)
        }
      } catch (err) {
        // Revert the optimistic UI; the StaleOrderModal (mounted at the
        // (pos) layout) is already showing if this was a stale conflict.
        setCourseState(course, currentState)
        if (!(err instanceof StaleOrderError)) {
          toast.error(err instanceof Error ? err.message : 'Failed to update course')
        }
      }
    },
    [courseStates, setCourseState, currentOrder, setCurrentOrderVersion]
  )

  // For-here / to-go derived state
  const isForHere = useMemo(() => {
    if (!currentOrder) return true
    if (currentOrder.for_here !== null) return currentOrder.for_here
    // Infer from order type
    return currentOrder.order_type === 'dine_in' || currentOrder.order_type === 'bar'
  }, [currentOrder])

  const reduced = useReducedMotion()

  const handleAttachGuest = useCallback(
    async (guest: NonNullable<typeof currentOrder>['guest']) => {
      if (!currentOrder || !guest) return
      if (currentOrder.order_number) {
        const res = await fetch(`/api/orders/${currentOrder.id}/guest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guest_id: guest.id }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          toast.error(json.error ?? 'Failed to attach guest')
          throw new Error(json.error ?? 'Failed to attach guest')
        }
      }
      attachGuest(guest)
    },
    [attachGuest, currentOrder]
  )

  const handleDetachGuest = useCallback(async () => {
    if (!currentOrder) return
    if (currentOrder.order_number) {
      const res = await fetch(`/api/orders/${currentOrder.id}/guest`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error ?? 'Failed to detach guest')
        throw new Error(json.error ?? 'Failed to detach guest')
      }
    }
    attachGuest(null)
  }, [attachGuest, currentOrder])

  const hasUnsentItems = currentOrder?.items.some(
    (i) => !i.voided && i.status === 'pending'
  ) ?? false

  const hasItems = (currentOrder?.items.filter((i) => !i.voided).length ?? 0) > 0

  // Find the item being edited for the popover
  const editItem = useMemo(() => {
    if (!editItemId || !currentOrder) return null
    return currentOrder.items.find((i) => i.id === editItemId) ?? null
  }, [editItemId, currentOrder])

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

        {/* Order type chips + For Here/To Go */}
        <div className="flex items-center gap-2 px-4 pb-2">
          <div className="flex-1 min-w-0">
            <OrderTypeChips
              value={currentOrder.order_type}
              onChange={(type) => setOrderType(type)}
            />
          </div>
          <ForHereToGoToggle
            forHere={isForHere}
            onChange={setForHere}
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

        <GuestAttachmentCard
          orderId={currentOrder.id}
          guest={currentOrder.guest}
          orderTotalCents={currentOrder.total_cents}
          onAttach={handleAttachGuest}
          onDetach={handleDetachGuest}
          onTotalsChanged={updateCurrentOrderTotals}
        />
      </div>

      {/* Item list -- scrollable middle, grouped by Seat then Course */}
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
            {seatGroups.map((seatGroup, seatIdx) => {
              const seatColor = getSeatColor(seatGroup.seatNumber)

              return (
                <div key={seatGroup.seatNumber ?? '__noseat'}>
                  {/* Seat divider (only when multiple seats exist) */}
                  {hasMultipleSeats && seatIdx > 0 && (
                    <div
                      className="mx-4 my-2"
                      style={{ borderTop: '1px solid var(--separator)' }}
                    />
                  )}

                  {/* Seat header (only when multiple seats) */}
                  {hasMultipleSeats && seatGroup.seatNumber !== null && (
                    <div className="flex items-center gap-2 px-4 py-1.5">
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded-full text-caption-2 font-bold text-white"
                        style={{ backgroundColor: seatColor ?? 'var(--color-text-muted)' }}
                      >
                        {seatGroup.seatNumber}
                      </span>
                      <span className="text-caption-1 font-bold text-muted-foreground uppercase tracking-wide">
                        Seat {seatGroup.seatNumber}
                      </span>
                    </div>
                  )}

                  {seatGroup.courseGroups.map((courseGroup) => {
                    const cState = courseStates[courseGroup.course] ?? (courseGroup.course === 1 ? 'fire' : 'hold')
                    const isHeld = cState === 'hold'

                    return (
                      <div key={courseGroup.course}>
                        {/* Course header (only when multiple courses) */}
                        {hasMultipleCourses && (
                          <CourseHeader
                            course={courseGroup.course}
                            courseState={cState}
                            onToggle={handleCourseToggle}
                          />
                        )}

                        {/* Items in this course */}
                        <AnimatePresence initial={false}>
                        {courseGroup.items.map((item) => {
                          const itemTotal =
                            item.price_cents * item.quantity +
                            item.modifiers.reduce(
                              (s, m) => s + m.price_cents * m.quantity,
                              0
                            )

                          return (
                            <motion.div
                              key={item.id}
                              layout={!reduced}
                              initial={reduced ? false : itemSpawn.initial}
                              animate={itemSpawn.animate}
                              exit={reduced ? undefined : itemSpawn.exit}
                              transition={reduced ? { duration: 0 } : itemSpawn.transition}
                              className={cn(
                                'relative mx-2 mb-1 rounded-xl',
                                item.voided && 'opacity-40',
                                editItemId === item.id && 'bg-[var(--info)]/[0.06] ring-1 ring-[var(--info)]/20',
                                flashId === item.id && 'animate-item-flash',
                                editItemId !== item.id && !item.voided && 'hover:bg-[var(--secondary)]',
                                isHeld && !item.voided && 'opacity-60'
                              )}
                            >
                              {/* Seat color left border */}
                              {seatColor && !item.voided && (
                                <div
                                  className="absolute left-0 top-2 bottom-2 rounded-full"
                                  style={{
                                    width: 4,
                                    backgroundColor: seatColor,
                                  }}
                                />
                              )}

                              <button
                                type="button"
                                onClick={(e) => handleItemTap(item.id, e)}
                                className={cn(
                                  'w-full text-left py-3',
                                  seatColor ? 'pl-4 pr-3' : 'px-3'
                                )}
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
                                    </div>

                                    {/* Modifiers */}
                                    {item.modifiers.length > 0 && (
                                      <div className="mt-1 pl-1">
                                        {item.modifiers.map((mod) => (
                                          <p
                                            key={mod.id}
                                            className="text-subhead text-muted-foreground leading-relaxed"
                                          >
                                            <span className="text-muted-foreground/40 mr-1.5">
                                              &bull;
                                            </span>
                                            {mod.name}
                                            {mod.price_cents !== 0 && (
                                              <span className="text-muted-foreground/60">
                                                {' '}(+
                                                <MoneyDisplay
                                                  cents={mod.price_cents}
                                                  className="text-subhead"
                                                />
                                                )
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
                                      item.voided
                                        ? 'line-through text-muted-foreground'
                                        : 'text-foreground'
                                    )}
                                  />
                                </div>
                              </button>

                              {/* Hairline separator */}
                              <div
                                className="absolute bottom-0 left-4 right-4"
                                style={{
                                  borderBottom: '0.5px solid var(--separator)',
                                  opacity: 0.5,
                                }}
                              />
                            </motion.div>
                          )
                        })}
                        </AnimatePresence>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Totals footer */}
      <div
        className="shrink-0 bg-white"
        style={{ borderTop: '0.5px solid var(--separator)' }}
      >
        <div className="px-4 pt-3 pb-2 space-y-1.5">
          <div className="flex items-center justify-between text-subhead">
            <span className="text-muted-foreground">Subtotal</span>
            <MoneyDisplay
              cents={currentOrder.subtotal_cents}
              className="font-medium tabular-nums"
            />
          </div>
          {currentOrder.discount_cents > 0 && (
            <div className="flex items-center justify-between text-subhead">
              <span className="text-[var(--success)]">Discount</span>
              <MoneyDisplay
                cents={-currentOrder.discount_cents}
                className="font-medium text-[var(--success)] tabular-nums"
              />
            </div>
          )}
          <div className="flex items-center justify-between text-subhead">
            <span className="text-muted-foreground">Tax</span>
            <MoneyDisplay
              cents={currentOrder.tax_cents}
              className="font-medium tabular-nums"
            />
          </div>
          <div
            className="flex items-center justify-between pt-2"
            style={{ borderTop: '0.5px solid var(--separator)' }}
          >
            <span className="text-title-2 font-black text-foreground">
              Total
            </span>
            <MoneyDisplay
              cents={currentOrder.total_cents}
              className="text-title-2 font-black text-foreground tabular-nums"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 px-4 pb-4">
          <button
            type="button"
            onClick={onSendToKitchen}
            disabled={isSending || !hasUnsentItems}
            className={cn(
              'btn-press touch-target-xl flex flex-1 items-center justify-center gap-2 rounded-2xl text-headline transition-all duration-150',
              hasUnsentItems
                ? 'bg-gradient-to-b from-[var(--color-primary-bright)] to-[var(--color-primary-gradient-end)] text-white shadow-[0_2px_8px_rgba(0,122,255,0.3)] hover:shadow-[0_4px_16px_rgba(0,122,255,0.4)] active:shadow-none'
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
              className="btn-press touch-target-xl flex flex-1 items-center justify-center gap-2 rounded-2xl text-headline bg-gradient-to-b from-[var(--color-success-hover-alt)] to-[var(--color-success-hover)] text-white shadow-[0_2px_8px_rgba(52,199,89,0.3)] hover:shadow-[0_4px_16px_rgba(52,199,89,0.4)] active:shadow-none transition-all duration-150"
              style={{ height: 56 }}
            >
              <CreditCard className="h-5 w-5" />
              Pay
            </button>
          )}
        </div>
      </div>

      {/* Item Edit Popover */}
      {editItem && !editItem.voided && (
        <ItemEditPopover
          item={editItem}
          anchorRect={editAnchorRect}
          onClose={handleClosePopover}
          onVoid={(id, name, isSent) => onItemVoid?.(id, name, isSent)}
          onComp={(id, name, price) => onItemComp?.(id, name, price)}
        />
      )}
    </div>
  )
}

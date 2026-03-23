'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  type UniqueIdentifier,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Plus,
  Users,
  SplitSquareHorizontal,
  Equal,
  CreditCard,
  GripVertical,
  X,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Scissors,
} from 'lucide-react'
import {
  calculateOrderTax,
  isOrderForHere,
  type TaxRate,
  type TaxableItem,
} from '@/lib/tax/tax-engine'

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

export interface SplitItem {
  id: string
  name: string
  quantity: number
  unit_price_cents: number
  line_total_cents: number
  seat_number: number | null
  modifiers: { name: string; price_adjustment_cents: number }[]
  is_voided: boolean
  is_comped: boolean
  tax_class: string
  is_taxable: boolean
  /** For partial splits: fraction of the original item assigned to this check (1.0 = whole) */
  split_fraction: number
  /** Original item ID (before splitting) */
  original_item_id: string
}

export interface CheckData {
  id: string
  label: string
  items: SplitItem[]
  is_paid: boolean
}

interface SplitCheckViewProps {
  orderId: string
  orderNumber: string
  tableName: string | null
  orderType: string
  forHere: boolean | null
  items: SplitItem[]
  taxRates: TaxRate[]
  onConfirm: (checks: CheckData[]) => Promise<void>
  onCancel: () => void
  onPayCheck: (checkIndex: number, checkData: CheckData) => void
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

const CHECK_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function calculateCheckTotals(
  items: SplitItem[],
  taxRates: TaxRate[],
  orderType: string,
  forHere: boolean | null
): { subtotal: number; tax: number; total: number } {
  const activeItems = items.filter((i) => !i.is_voided)
  const subtotal = activeItems.reduce((sum, item) => {
    const itemAmount = Math.round(item.line_total_cents * item.split_fraction)
    return sum + itemAmount
  }, 0)

  if (taxRates.length === 0) {
    return { subtotal, tax: 0, total: subtotal }
  }

  const taxableItems: TaxableItem[] = activeItems.map((item) => ({
    taxable_amount_cents: Math.round(item.line_total_cents * item.split_fraction),
    tax_class: item.tax_class ?? 'food',
    is_taxable: item.is_taxable ?? true,
  }))

  const forHereCalc = isOrderForHere(orderType, forHere)
  const taxResult = calculateOrderTax(taxableItems, taxRates, forHereCalc)

  return {
    subtotal,
    tax: taxResult.total_tax_cents,
    total: subtotal + taxResult.total_tax_cents,
  }
}

// ---------------------------------------------------------------
// Draggable Item
// ---------------------------------------------------------------

function DraggableItem({
  item,
  isDragOverlay,
}: {
  item: SplitItem
  isDragOverlay?: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
  })

  const amountCents = Math.round(item.line_total_cents * item.split_fraction)

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      {...(isDragOverlay ? {} : { ...listeners, ...attributes })}
      className={cn(
        'flex items-center gap-2 rounded-lg border bg-white px-3 py-2.5 transition-all',
        isDragging && !isDragOverlay && 'opacity-30',
        isDragOverlay && 'shadow-xl rotate-1 scale-105 border-[var(--primary)]',
        !isDragging && !isDragOverlay && 'border-border hover:border-[var(--border-hover)] cursor-grab active:cursor-grabbing'
      )}
      style={{ touchAction: 'none' }}
    >
      <GripVertical className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {item.seat_number !== null && (
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--info-bg)] text-[10px] font-bold text-[var(--info)]">
              S{item.seat_number}
            </span>
          )}
          <span className="text-sm font-medium text-[var(--text-primary)] truncate">
            {item.quantity > 1 && <span className="font-bold mr-1">{item.quantity}x</span>}
            {item.name}
          </span>
          {item.split_fraction < 1 && (
            <span className="text-[10px] font-bold text-[var(--warning)] bg-[var(--warning-bg)] px-1 rounded">
              {Math.round(item.split_fraction * 100)}%
            </span>
          )}
          {item.is_comped && (
            <span className="text-[10px] font-bold text-[var(--warning)] bg-[var(--warning-bg)] px-1 rounded">
              COMP
            </span>
          )}
        </div>
        {item.modifiers.length > 0 && (
          <p className="text-xs text-[var(--text-muted)] pl-6 truncate">
            {item.modifiers.map((m) => m.name).join(', ')}
          </p>
        )}
      </div>
      <MoneyDisplay
        cents={amountCents}
        className={cn(
          'text-sm font-semibold shrink-0',
          item.is_comped && 'line-through text-[var(--text-muted)]'
        )}
      />
    </div>
  )
}

// ---------------------------------------------------------------
// Droppable Check Panel
// ---------------------------------------------------------------

function CheckPanel({
  check,
  taxRates,
  orderType,
  forHere,
  onRemoveCheck,
  onSplitItem,
  onPayCheck,
  canRemove,
}: {
  check: CheckData
  taxRates: TaxRate[]
  orderType: string
  forHere: boolean | null
  onRemoveCheck: () => void
  onSplitItem: (itemId: string) => void
  onPayCheck: () => void
  canRemove: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `check-${check.id}` })
  const totals = useMemo(
    () => calculateCheckTotals(check.items, taxRates, orderType, forHere),
    [check.items, taxRates, orderType, forHere]
  )

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col rounded-xl border-2 bg-white transition-all duration-150 shrink-0',
        isOver && !check.is_paid
          ? 'border-[var(--primary)] shadow-warm-lg bg-[var(--primary-subtle)]'
          : check.is_paid
            ? 'border-[var(--success)] bg-[var(--success-bg)]'
            : 'border-border'
      )}
      style={{ width: 280, minHeight: 300 }}
    >
      {/* Check header */}
      <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: '0.5px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[var(--text-primary)]">
            Check {check.label}
          </span>
          {check.is_paid && (
            <span className="text-[10px] font-bold text-[var(--success)] bg-[var(--success-bg)] px-1.5 py-0.5 rounded-full">
              PAID
            </span>
          )}
        </div>
        {canRemove && !check.is_paid && check.items.length === 0 && (
          <button
            type="button"
            onClick={onRemoveCheck}
            className="btn-press flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--error-bg)] hover:text-[var(--error)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-[120px]">
        {check.items.length === 0 && (
          <div className="flex h-full items-center justify-center py-8">
            <p className="text-xs text-[var(--text-muted)] text-center">
              Drag items here
            </p>
          </div>
        )}
        {check.items.map((item) => (
          <div key={item.id} className="group relative">
            <DraggableItem item={item} />
            {!check.is_paid && (
              <button
                type="button"
                onClick={() => onSplitItem(item.id)}
                className="absolute right-1 top-1 hidden group-hover:flex h-6 w-6 items-center justify-center rounded-md bg-[var(--warning-bg)] text-[var(--warning)] hover:bg-[var(--warning)] hover:text-white transition-colors"
                title="Split this item"
              >
                <Scissors className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="px-3 py-2.5" style={{ borderTop: '0.5px solid var(--border)' }}>
        <div className="space-y-0.5">
          <div className="flex justify-between text-xs text-[var(--text-secondary)]">
            <span>Subtotal</span>
            <MoneyDisplay cents={totals.subtotal} className="text-xs" />
          </div>
          <div className="flex justify-between text-xs text-[var(--text-secondary)]">
            <span>Tax</span>
            <MoneyDisplay cents={totals.tax} className="text-xs" />
          </div>
          <div className="flex justify-between text-sm font-bold text-[var(--text-primary)] pt-1" style={{ borderTop: '0.5px solid var(--border)' }}>
            <span>Total</span>
            <MoneyDisplay cents={totals.total} className="text-sm font-bold" />
          </div>
        </div>
        {!check.is_paid && check.items.length > 0 && (
          <button
            type="button"
            onClick={onPayCheck}
            className="btn-press w-full mt-2 flex items-center justify-center gap-2 rounded-lg bg-[var(--success)] py-2.5 text-xs font-semibold text-white transition-all hover:bg-[var(--success-hover)]"
            style={{ minHeight: 44 }}
          >
            <CreditCard className="h-4 w-4" />
            Pay This Check
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------
// Split Item Dialog
// ---------------------------------------------------------------

function SplitItemDialog({
  item,
  checkCount,
  onSplit,
  onCancel,
}: {
  item: SplitItem
  checkCount: number
  onSplit: (splits: { checkIndex: number; fraction: number }[]) => void
  onCancel: () => void
}) {
  const [splitType, setSplitType] = useState<'equal' | 'custom'>('equal')
  const [customAmounts, setCustomAmounts] = useState<number[]>(
    Array.from({ length: checkCount }, () => 0)
  )
  const totalCents = Math.round(item.line_total_cents * item.split_fraction)

  const handleEqualSplit = useCallback(() => {
    const splits = Array.from({ length: checkCount }, (_, i) => ({
      checkIndex: i,
      fraction: 1 / checkCount,
    }))
    onSplit(splits)
  }, [checkCount, onSplit])

  const handleCustomSplit = useCallback(() => {
    const totalCustom = customAmounts.reduce((s, a) => s + a, 0)
    if (totalCustom === 0) {
      toast.error('Enter split amounts')
      return
    }
    const splits = customAmounts
      .map((amount, i) => ({
        checkIndex: i,
        fraction: amount / totalCustom,
      }))
      .filter((s) => s.fraction > 0)
    onSplit(splits)
  }, [customAmounts, onSplit])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">
          Split Item
        </h3>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Split &ldquo;{item.name}&rdquo; (<MoneyDisplay cents={totalCents} className="text-sm font-semibold" />) between checks
        </p>

        {/* Split type tabs */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setSplitType('equal')}
            className={cn(
              'btn-press flex-1 rounded-lg py-2 text-sm font-semibold transition-all',
              splitType === 'equal'
                ? 'bg-[var(--primary)] text-white'
                : 'bg-[var(--secondary)] text-[var(--text-secondary)]'
            )}
          >
            Split Equally
          </button>
          <button
            type="button"
            onClick={() => setSplitType('custom')}
            className={cn(
              'btn-press flex-1 rounded-lg py-2 text-sm font-semibold transition-all',
              splitType === 'custom'
                ? 'bg-[var(--primary)] text-white'
                : 'bg-[var(--secondary)] text-[var(--text-secondary)]'
            )}
          >
            Custom Amounts
          </button>
        </div>

        {splitType === 'equal' && (
          <div className="text-center mb-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Split equally across {checkCount} checks
            </p>
            <p className="text-lg font-bold text-[var(--text-primary)] mt-1">
              <MoneyDisplay cents={Math.round(totalCents / checkCount)} className="text-lg font-bold" /> each
            </p>
          </div>
        )}

        {splitType === 'custom' && (
          <div className="space-y-2 mb-4">
            {Array.from({ length: checkCount }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm font-semibold text-[var(--text-primary)] w-16">
                  Check {CHECK_LABELS[i]}
                </span>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)]">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={customAmounts[i] > 0 ? (customAmounts[i] / 100).toFixed(2) : ''}
                    onChange={(e) => {
                      const cents = Math.round(parseFloat(e.target.value || '0') * 100)
                      setCustomAmounts((prev) => {
                        const next = [...prev]
                        next[i] = cents
                        return next
                      })
                    }}
                    className="h-10 w-full rounded-lg border border-border bg-[var(--secondary)] pl-7 pr-3 text-sm font-semibold text-[var(--text-primary)] tabular-nums focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
                    placeholder="0.00"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="btn-press flex-1 rounded-lg border border-border py-2.5 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--secondary)]"
            style={{ minHeight: 44 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={splitType === 'equal' ? handleEqualSplit : handleCustomSplit}
            className="btn-press flex-1 rounded-lg bg-[var(--primary)] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-hover)]"
            style={{ minHeight: 44 }}
          >
            Split Item
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------
// Main SplitCheckView
// ---------------------------------------------------------------

export function SplitCheckView({
  orderId,
  orderNumber,
  tableName,
  orderType,
  forHere,
  items: initialItems,
  taxRates,
  onConfirm,
  onCancel,
  onPayCheck,
}: SplitCheckViewProps) {
  const [checks, setChecks] = useState<CheckData[]>([
    { id: crypto.randomUUID(), label: 'A', items: [], is_paid: false },
    { id: crypto.randomUUID(), label: 'B', items: [], is_paid: false },
  ])

  // Items not yet assigned to any check
  const [unassignedItems, setUnassignedItems] = useState<SplitItem[]>(
    initialItems.filter((i) => !i.is_voided)
  )

  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)
  const [splitItemId, setSplitItemId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  )

  // Find the item being dragged across all containers
  const findItemById = useCallback(
    (id: UniqueIdentifier): SplitItem | undefined => {
      const inUnassigned = unassignedItems.find((i) => i.id === id)
      if (inUnassigned) return inUnassigned
      for (const check of checks) {
        const found = check.items.find((i) => i.id === id)
        if (found) return found
      }
      return undefined
    },
    [unassignedItems, checks]
  )

  // Find which container an item is in
  const findContainerForItem = useCallback(
    (itemId: UniqueIdentifier): string => {
      if (unassignedItems.some((i) => i.id === itemId)) return 'unassigned'
      for (const check of checks) {
        if (check.items.some((i) => i.id === itemId)) return `check-${check.id}`
      }
      return 'unassigned'
    },
    [unassignedItems, checks]
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)

      if (!over) return

      const itemId = active.id
      const sourceContainer = findContainerForItem(itemId)
      let targetContainer = String(over.id)

      // If dropping on an item, find its container
      if (!targetContainer.startsWith('check-') && targetContainer !== 'unassigned') {
        targetContainer = findContainerForItem(over.id)
      }

      if (sourceContainer === targetContainer) return

      // Check if target is a paid check
      const targetCheck = checks.find((c) => `check-${c.id}` === targetContainer)
      if (targetCheck?.is_paid) {
        toast.error('Cannot move items to a paid check')
        return
      }

      // Check if source is a paid check
      const sourceCheck = checks.find((c) => `check-${c.id}` === sourceContainer)
      if (sourceCheck?.is_paid) {
        toast.error('Cannot move items from a paid check')
        return
      }

      const item = findItemById(itemId)
      if (!item) return

      // Remove from source
      if (sourceContainer === 'unassigned') {
        setUnassignedItems((prev) => prev.filter((i) => i.id !== itemId))
      } else {
        setChecks((prev) =>
          prev.map((c) =>
            `check-${c.id}` === sourceContainer
              ? { ...c, items: c.items.filter((i) => i.id !== itemId) }
              : c
          )
        )
      }

      // Add to target
      if (targetContainer === 'unassigned') {
        setUnassignedItems((prev) => [...prev, item])
      } else {
        setChecks((prev) =>
          prev.map((c) =>
            `check-${c.id}` === targetContainer
              ? { ...c, items: [...c.items, item] }
              : c
          )
        )
      }
    },
    [checks, findContainerForItem, findItemById]
  )

  const handleAddCheck = useCallback(() => {
    const nextLabel = CHECK_LABELS[checks.length] ?? `${checks.length + 1}`
    setChecks((prev) => [
      ...prev,
      { id: crypto.randomUUID(), label: nextLabel, items: [], is_paid: false },
    ])
  }, [checks.length])

  const handleRemoveCheck = useCallback(
    (checkId: string) => {
      const check = checks.find((c) => c.id === checkId)
      if (!check) return
      if (check.items.length > 0) {
        // Move items back to unassigned
        setUnassignedItems((prev) => [...prev, ...check.items])
      }
      setChecks((prev) => prev.filter((c) => c.id !== checkId))
    },
    [checks]
  )

  const handleEvenSplit = useCallback(() => {
    const allItems = [
      ...unassignedItems,
      ...checks.flatMap((c) => (c.is_paid ? [] : c.items)),
    ]
    const n = checks.length
    const newChecks = checks.map((c, i) => {
      if (c.is_paid) return c
      const start = Math.floor((i * allItems.length) / n)
      const end = Math.floor(((i + 1) * allItems.length) / n)
      return { ...c, items: allItems.slice(start, end) }
    })
    setChecks(newChecks)
    setUnassignedItems([])
  }, [unassignedItems, checks])

  const handleSplitBySeat = useCallback(() => {
    const allItems = [
      ...unassignedItems,
      ...checks.flatMap((c) => (c.is_paid ? [] : c.items)),
    ]
    const seatMap = new Map<number, SplitItem[]>()
    for (const item of allItems) {
      const seat = item.seat_number ?? 1
      if (!seatMap.has(seat)) seatMap.set(seat, [])
      seatMap.get(seat)!.push(item)
    }

    const seats = Array.from(seatMap.keys()).sort()
    if (seats.length < 2) {
      toast.error('Need items on at least 2 seats to split by seat')
      return
    }

    const newChecks = seats.map((seat, i) => ({
      id: crypto.randomUUID(),
      label: CHECK_LABELS[i] ?? `${i + 1}`,
      items: seatMap.get(seat) ?? [],
      is_paid: false,
    }))

    setChecks(newChecks)
    setUnassignedItems([])
  }, [unassignedItems, checks])

  // Handle splitting a single item across checks
  const handleSplitItem = useCallback(
    (itemId: string) => {
      setSplitItemId(itemId)
    },
    []
  )

  const itemToSplit = useMemo(() => {
    if (!splitItemId) return null
    return findItemById(splitItemId) ?? null
  }, [splitItemId, findItemById])

  const handleSplitConfirm = useCallback(
    (splits: { checkIndex: number; fraction: number }[]) => {
      if (!splitItemId) return
      const item = findItemById(splitItemId)
      if (!item) return

      // Remove original item from wherever it is
      const sourceContainer = findContainerForItem(splitItemId)
      if (sourceContainer === 'unassigned') {
        setUnassignedItems((prev) => prev.filter((i) => i.id !== splitItemId))
      } else {
        setChecks((prev) =>
          prev.map((c) =>
            `check-${c.id}` === sourceContainer
              ? { ...c, items: c.items.filter((i) => i.id !== splitItemId) }
              : c
          )
        )
      }

      // Create split copies in each target check
      setChecks((prev) =>
        prev.map((check, i) => {
          const split = splits.find((s) => s.checkIndex === i)
          if (!split || split.fraction <= 0) return check
          const splitItem: SplitItem = {
            ...item,
            id: crypto.randomUUID(),
            split_fraction: item.split_fraction * split.fraction,
            original_item_id: item.original_item_id,
          }
          return { ...check, items: [...check.items, splitItem] }
        })
      )

      setSplitItemId(null)
    },
    [splitItemId, findItemById, findContainerForItem]
  )

  const handleConfirmSplit = useCallback(async () => {
    if (unassignedItems.length > 0) {
      toast.error('All items must be assigned to a check')
      return
    }
    const nonEmptyChecks = checks.filter((c) => c.items.length > 0)
    if (nonEmptyChecks.length < 2) {
      toast.error('At least 2 checks must have items')
      return
    }
    setIsConfirming(true)
    try {
      await onConfirm(nonEmptyChecks)
    } catch {
      toast.error('Failed to split order')
    } finally {
      setIsConfirming(false)
    }
  }, [unassignedItems, checks, onConfirm])

  const activeItem = activeId ? findItemById(activeId) : null

  // Droppable for unassigned column
  const { setNodeRef: unassignedRef, isOver: isOverUnassigned } = useDroppable({
    id: 'unassigned',
  })

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full flex-col bg-[var(--background)]">
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-4 shrink-0"
          style={{ height: 56, borderBottom: '0.5px solid var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="btn-press flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--secondary)] transition-colors"
              style={{ minHeight: 44 }}
            >
              <ArrowLeft className="h-4 w-4" />
              Cancel
            </button>
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)]">
                Split Check {tableName ? `\u2014 ${tableName}` : ''} #{orderNumber}
              </h2>
              {unassignedItems.length > 0 && (
                <p className="text-xs text-[var(--warning)] font-semibold">
                  {unassignedItems.length} unassigned item{unassignedItems.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick actions */}
            <button
              type="button"
              onClick={handleEvenSplit}
              className="btn-press flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--secondary)] transition-colors"
              style={{ minHeight: 44 }}
            >
              <Equal className="h-4 w-4" />
              Even Split
            </button>
            <button
              type="button"
              onClick={handleSplitBySeat}
              className="btn-press flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--secondary)] transition-colors"
              style={{ minHeight: 44 }}
            >
              <Users className="h-4 w-4" />
              Split by Seat
            </button>
            <button
              type="button"
              onClick={handleAddCheck}
              disabled={checks.length >= 26}
              className="btn-press flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--secondary)] transition-colors disabled:opacity-30"
              style={{ minHeight: 44 }}
            >
              <Plus className="h-4 w-4" />
              Add Check
            </button>

            <button
              type="button"
              onClick={handleConfirmSplit}
              disabled={isConfirming || unassignedItems.length > 0}
              className="btn-press flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-40"
              style={{ minHeight: 44 }}
            >
              {isConfirming ? 'Splitting...' : 'Confirm Split'}
            </button>
          </div>
        </div>

        {/* Main content: unassigned + checks */}
        <div className="flex-1 flex overflow-hidden">
          {/* Unassigned column */}
          <div
            ref={unassignedRef}
            className={cn(
              'flex flex-col shrink-0 border-r transition-colors',
              isOverUnassigned ? 'bg-[var(--warning-bg)] border-[var(--warning)]' : 'bg-white border-border'
            )}
            style={{ width: 300 }}
          >
            <div className="shrink-0 px-3 py-2.5" style={{ borderBottom: '0.5px solid var(--border)' }}>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Unassigned Items</h3>
              <p className="text-xs text-[var(--text-muted)]">
                {unassignedItems.length} item{unassignedItems.length !== 1 ? 's' : ''} remaining
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {unassignedItems.length === 0 ? (
                <div className="flex h-full items-center justify-center py-8">
                  <div className="text-center">
                    <SplitSquareHorizontal className="h-8 w-8 mx-auto text-[var(--text-muted)] mb-2" />
                    <p className="text-xs text-[var(--text-muted)]">All items assigned</p>
                  </div>
                </div>
              ) : (
                unassignedItems.map((item) => (
                  <div key={item.id} className="group relative">
                    <DraggableItem item={item} />
                    <button
                      type="button"
                      onClick={() => handleSplitItem(item.id)}
                      className="absolute right-1 top-1 hidden group-hover:flex h-6 w-6 items-center justify-center rounded-md bg-[var(--warning-bg)] text-[var(--warning)] hover:bg-[var(--warning)] hover:text-white transition-colors"
                      title="Split this item"
                    >
                      <Scissors className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Check panels (horizontally scrollable) */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            <div className="flex gap-3 p-3 h-full" style={{ minWidth: 'min-content' }}>
              {checks.map((check) => (
                <CheckPanel
                  key={check.id}
                  check={check}
                  taxRates={taxRates}
                  orderType={orderType}
                  forHere={forHere}
                  onRemoveCheck={() => handleRemoveCheck(check.id)}
                  onSplitItem={handleSplitItem}
                  onPayCheck={() => onPayCheck(checks.indexOf(check), check)}
                  canRemove={checks.length > 2}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activeItem ? <DraggableItem item={activeItem} isDragOverlay /> : null}
      </DragOverlay>

      {/* Split item dialog */}
      {itemToSplit && (
        <SplitItemDialog
          item={itemToSplit}
          checkCount={checks.length}
          onSplit={handleSplitConfirm}
          onCancel={() => setSplitItemId(null)}
        />
      )}
    </DndContext>
  )
}

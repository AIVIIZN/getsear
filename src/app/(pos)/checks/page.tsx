'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui-v2/Button'
import { Card } from '@/components/ui-v2/Card'
import { Tabs, type TabItem } from '@/components/ui-v2/navigation/Tabs'
import { Badge } from '@/components/ui-v2/data/Badge'
import { Skeleton } from '@/components/ui-v2/data/Skeleton'
import { EmptyState } from '@/components/ui-v2/feedback/EmptyState'
import { NumberInput } from '@/components/ui-v2/inputs/Number'
import { SplitCheckView, type SplitItem } from '@/components/pos/SplitCheckView'
import { MultiTenderPayment } from '@/components/pos/MultiTenderPayment'
import { useOrderStore } from '@/stores/order-store'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Receipt,
  SplitSquareHorizontal,
  Users,
  ArrowRightLeft,
  CreditCard,
  Printer,
  Merge,
} from 'lucide-react'

interface OrderItem {
  id: string
  name: string
  quantity: number
  unit_price: string
  line_total: string
  seat_number: number | null
  course: number
  is_voided: boolean
  is_comped: boolean
  modifiers: { name: string; price_adjustment: string }[]
  tax_class?: string
  is_taxable?: boolean
}

interface OrderSummary {
  id: string
  order_number: number
  display_number: string
  order_type: string
  status: string
  table_id: string | null
  table_name: string | null
  server_name: string | null
  server_id: string
  guest_count: number
  subtotal: string
  discount_total: string
  tax_total: string
  total: string
  balance_due: string
  amount_paid: string
  created_at: string
  for_here?: boolean | null
  order_items?: OrderItem[]
}

type ViewMode = 'list' | 'split' | 'payment'

interface CheckPaymentTarget {
  orderId: string
  totalCents: number
  subtotalCents: number
  taxCents: number
  discountCents: number
}

// ---------------------------------------------------------------
// Custom amount split — uses ui-v2 NumberInput + Button.
// ---------------------------------------------------------------

function CustomAmountSplit({
  totalCents,
  orderId,
  onComplete,
}: {
  totalCents: number
  orderId: string
  onComplete: () => void
}) {
  const [amountStr, setAmountStr] = useState('')
  const [splitting, setSplitting] = useState(false)

  const amountCents = Math.round(parseFloat(amountStr || '0') * 100)
  const remainderCents = totalCents - amountCents
  const isValid = amountCents > 0 && amountCents < totalCents

  const handleSplit = async () => {
    if (!isValid) return
    setSplitting(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'custom_amount', amount_cents: amountCents }),
      })
      if (res.ok) {
        toast.success(`Split $${(amountCents / 100).toFixed(2)} to new check`)
        onComplete()
      } else {
        toast.error('Failed to split')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSplitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      <NumberInput
        size="lg"
        step="0.01"
        min="0"
        placeholder="0.00"
        value={amountStr}
        onChange={(e) => setAmountStr(e.target.value)}
        leadingIcon={<span className="text-[length:var(--type-headline-size)] font-[var(--weight-semibold)]">$</span>}
        helper={
          isValid ? (
            <>
              Remainder:{' '}
              <span className="font-[var(--weight-semibold)]">
                <MoneyDisplay cents={remainderCents} className="text-[length:var(--type-footnote-size)]" />
              </span>
            </>
          ) : undefined
        }
      />
      <Button
        variant="primary"
        size="xl"
        loading={splitting}
        disabled={!isValid}
        onClick={handleSplit}
        className="w-full"
      >
        {splitting ? 'Splitting' : 'Split Amount'}
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------
// Main Checks Page
// ---------------------------------------------------------------

type SplitMode = 'equal' | 'seat' | 'custom' | 'drag'

const SPLIT_MODE_TABS: TabItem[] = [
  { value: 'drag', label: 'Drag & Drop', icon: <SplitSquareHorizontal /> },
  { value: 'equal', label: 'Equal Split', icon: <Users /> },
  { value: 'seat', label: 'By Seat', icon: <Users /> },
  { value: 'custom', label: 'Custom', icon: <ArrowRightLeft /> },
]

export default function ChecksPage() {
  const router = useRouter()
  void router
  const taxRates = useOrderStore((s) => s.taxRates)
  const activeLocationId = useAuthStore((s) => s.activeLocationId)

  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<OrderSummary | null>(null)
  const [splitMode, setSplitMode] = useState<SplitMode>('equal')
  const [splitCount, setSplitCount] = useState<number | null>(null)
  const [isSplitting, setIsSplitting] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [paymentTarget, setPaymentTarget] = useState<CheckPaymentTarget | null>(null)

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders?status=open,fired,ready,served')
      if (res.ok) {
        const data = await res.json()
        setOrders(data.data ?? [])
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  useEffect(() => {
    if (!selectedOrderId) {
      setSelectedOrder(null)
      return
    }
    async function fetchOrderDetail() {
      try {
        const res = await fetch(`/api/orders/${selectedOrderId}`)
        if (res.ok) {
          const json = await res.json()
          setSelectedOrder(json.data)
        }
      } catch {
        // silent
      }
    }
    fetchOrderDetail()
  }, [selectedOrderId])

  const handleEqualSplit = useCallback(
    async (count: number) => {
      if (!selectedOrderId) return
      setSplitCount(count)
      setIsSplitting(true)
      try {
        const res = await fetch(`/api/orders/${selectedOrderId}/split`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'equal', split_count: count }),
        })
        if (res.ok) {
          const json = await res.json()
          const newCount = json.data.new_order_ids.length
          toast.success(`Split into ${count} checks`, {
            description: `Created ${newCount} new check${newCount > 1 ? 's' : ''}`,
          })
          fetchOrders()
          setSelectedOrderId(null)
        } else {
          const err = await res.json().catch(() => ({ error: 'Split failed' }))
          toast.error(err.error ?? 'Failed to split order')
        }
      } catch {
        toast.error('Network error')
      } finally {
        setIsSplitting(false)
        setSplitCount(null)
      }
    },
    [selectedOrderId, fetchOrders]
  )

  const handleSeatSplit = useCallback(async () => {
    if (!selectedOrderId) return
    setIsSplitting(true)
    try {
      const res = await fetch(`/api/orders/${selectedOrderId}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'by_seat' }),
      })
      if (res.ok) {
        const json = await res.json()
        toast.success('Split by seat', {
          description: `Created ${json.data.new_order_ids.length} new checks`,
        })
        fetchOrders()
        setSelectedOrderId(null)
      } else {
        const err = await res.json().catch(() => ({ error: 'Split failed' }))
        toast.error(err.error ?? 'Failed to split by seat')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setIsSplitting(false)
    }
  }, [selectedOrderId, fetchOrders])

  const handlePrintCheck = useCallback(async () => {
    if (!selectedOrderId) return
    try {
      await fetch(`/api/orders/${selectedOrderId}/print-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'receipt' }),
      })
      toast.success('Check printed')
    } catch {
      window.print()
    }
  }, [selectedOrderId])

  const handleProcessPayment = useCallback(() => {
    if (!selectedOrder) return
    const totalCents = Math.round(
      parseFloat(selectedOrder.balance_due || selectedOrder.total) * 100
    )
    const subtotalCents = Math.round(parseFloat(selectedOrder.subtotal) * 100)
    const taxCents = Math.round(parseFloat(selectedOrder.tax_total) * 100)
    const discountCents = Math.round(parseFloat(selectedOrder.discount_total) * 100)

    setPaymentTarget({
      orderId: selectedOrder.id,
      totalCents,
      subtotalCents,
      taxCents,
      discountCents,
    })
    setViewMode('payment')
  }, [selectedOrder])

  const handleDragSplit = useCallback(() => {
    if (!selectedOrder?.order_items) {
      toast.error('No items to split')
      return
    }
    setViewMode('split')
  }, [selectedOrder])

  const handleSplitConfirm = useCallback(
    async (checks: Array<{ id: string; label: string; items: SplitItem[]; is_paid: boolean }>) => {
      if (!selectedOrderId) return

      const itemAssignments = checks.flatMap((check, i) =>
        check.items.map((item) => ({
          item_id: item.original_item_id,
          target_check: i,
        }))
      )

      try {
        const res = await fetch(`/api/orders/${selectedOrderId}/split`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'custom',
            item_assignments: itemAssignments,
          }),
        })
        if (res.ok) {
          toast.success(`Split into ${checks.length} checks`)
          setViewMode('list')
          fetchOrders()
          setSelectedOrderId(null)
        } else {
          const err = await res.json().catch(() => ({ error: 'Split failed' }))
          toast.error(err.error ?? 'Failed to split order')
        }
      } catch {
        toast.error('Network error')
      }
    },
    [selectedOrderId, fetchOrders]
  )

  const handlePaySplitCheck = useCallback(
    (_checkIndex: number, checkData: { id: string; items: SplitItem[] }) => {
      const subtotalCents = checkData.items.reduce(
        (sum, item) => sum + Math.round(item.line_total_cents * item.split_fraction),
        0
      )
      const taxCents = Math.round(subtotalCents * 0.08)
      const totalCents = subtotalCents + taxCents

      setPaymentTarget({
        orderId: selectedOrderId ?? '',
        totalCents,
        subtotalCents,
        taxCents,
        discountCents: 0,
      })
      setViewMode('payment')
    },
    [selectedOrderId]
  )

  const [mergeMode, setMergeMode] = useState(false)
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null)
  void mergeTargetId

  const handleMerge = useCallback(async () => {
    if (!selectedOrderId) return
    setMergeMode(true)
    toast.info('Tap a second check to merge into this one')
  }, [selectedOrderId])

  const handleMergeTarget = useCallback(
    async (targetId: string) => {
      if (!selectedOrderId || targetId === selectedOrderId) return
      setMergeTargetId(targetId)
      try {
        const res = await fetch(`/api/orders/${selectedOrderId}/merge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source_order_id: targetId }),
        })
        if (res.ok) {
          toast.success('Checks merged successfully')
          fetchOrders()
          setSelectedOrderId(null)
        } else {
          const err = await res.json().catch(() => ({ error: 'Merge failed' }))
          toast.error(err.error ?? 'Failed to merge checks')
        }
      } catch {
        toast.error('Network error')
      } finally {
        setMergeMode(false)
        setMergeTargetId(null)
      }
    },
    [selectedOrderId, fetchOrders]
  )

  const totalCents = selectedOrder
    ? Math.round(parseFloat(selectedOrder.total) * 100)
    : 0
  const balanceDueCents = selectedOrder
    ? Math.round(parseFloat(selectedOrder.balance_due || selectedOrder.total) * 100)
    : 0
  const amountPaidCents = selectedOrder
    ? Math.round(parseFloat(selectedOrder.amount_paid || '0') * 100)
    : 0

  // ---------------------------------------------------------------
  // Render: Drag-and-Drop Split View
  // ---------------------------------------------------------------
  if (viewMode === 'split' && selectedOrder?.order_items) {
    const splitItems: SplitItem[] = selectedOrder.order_items
      .filter((i) => !i.is_voided)
      .map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit_price_cents: Math.round(parseFloat(item.unit_price) * 100),
        line_total_cents: Math.round(parseFloat(item.line_total) * 100),
        seat_number: item.seat_number,
        modifiers: item.modifiers.map((m) => ({
          name: m.name,
          price_adjustment_cents: Math.round(parseFloat(m.price_adjustment) * 100),
        })),
        is_voided: item.is_voided,
        is_comped: item.is_comped,
        tax_class: item.tax_class ?? 'food',
        is_taxable: item.is_taxable ?? true,
        split_fraction: 1,
        original_item_id: item.id,
      }))

    return (
      <SplitCheckView
        orderId={selectedOrder.id}
        orderNumber={selectedOrder.display_number || String(selectedOrder.order_number)}
        tableName={selectedOrder.table_name}
        orderType={selectedOrder.order_type}
        forHere={selectedOrder.for_here ?? null}
        items={splitItems}
        taxRates={taxRates}
        onConfirm={handleSplitConfirm}
        onCancel={() => setViewMode('list')}
        onPayCheck={handlePaySplitCheck}
      />
    )
  }

  // ---------------------------------------------------------------
  // Render: Multi-Tender Payment View
  // ---------------------------------------------------------------
  if (viewMode === 'payment' && paymentTarget) {
    return (
      <MultiTenderPayment
        orderId={paymentTarget.orderId}
        locationId={activeLocationId ?? ''}
        totalCents={paymentTarget.totalCents}
        subtotalCents={paymentTarget.subtotalCents}
        taxCents={paymentTarget.taxCents}
        discountCents={paymentTarget.discountCents}
        onComplete={() => {
          setViewMode('list')
          setPaymentTarget(null)
          fetchOrders()
          setSelectedOrderId(null)
        }}
        onCancel={() => {
          setViewMode('list')
          setPaymentTarget(null)
        }}
      />
    )
  }

  // ---------------------------------------------------------------
  // Render: Loading
  // ---------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex h-full">
        <div
          className="w-80 flex flex-col bg-[var(--color-surface)] p-[var(--space-3)] gap-[var(--space-2)]"
          style={{ borderRight: '0.5px solid var(--color-border)' }}
        >
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
        <div className="flex-1 p-[var(--space-6)] flex flex-col gap-[var(--space-4)]">
          <Skeleton variant="text" lines={3} />
          <Skeleton variant="chart" />
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------
  // Render: Standard List View
  // ---------------------------------------------------------------
  return (
    <div className="flex h-full gap-0 no-select">
      {/* Left: Order list */}
      <div
        className="w-80 flex flex-col bg-[var(--color-surface)]"
        style={{ borderRight: '0.5px solid var(--color-border)' }}
      >
        <div
          className="shrink-0 px-[var(--space-4)] py-[var(--space-3)]"
          style={{ borderBottom: '0.5px solid var(--color-border)' }}
        >
          <h2 className="text-[length:var(--type-headline-size)] font-[var(--weight-semibold)] text-[var(--color-text)]">
            {mergeMode ? 'Select Check to Merge' : 'Open Checks'}
          </h2>
          <p className="mt-[var(--space-1)] text-[length:var(--type-footnote-size)] text-[var(--color-text-muted)]">
            {mergeMode
              ? 'Tap a check to merge into the selected one'
              : `${orders.length} active order${orders.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide p-[var(--space-2)] flex flex-col gap-[var(--space-2)]">
          {orders.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No open checks"
              description="Active orders will appear here"
            />
          ) : (
            orders.map((order) => {
              const orderTotal = Math.round(parseFloat(order.total) * 100)
              const isSelected = selectedOrderId === order.id
              const orderPaid = Math.round(parseFloat(order.amount_paid || '0') * 100)
              const isPartiallyPaid = orderPaid > 0 && orderPaid < orderTotal
              return (
                <Card
                  key={order.id}
                  variant={isSelected ? 'flat' : 'interactive'}
                  padding="compact"
                  onClick={() => {
                    if (mergeMode && selectedOrderId && order.id !== selectedOrderId) {
                      handleMergeTarget(order.id)
                    } else {
                      setSelectedOrderId(isSelected ? null : order.id)
                    }
                  }}
                  className={cn(
                    'touch-target gap-[var(--space-2)]',
                    isSelected
                      ? 'border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)]'
                      : ''
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[length:var(--type-subhead-size)] font-[var(--weight-semibold)] text-[var(--color-text)]">
                      #{order.display_number || order.order_number}
                    </span>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="flex items-center justify-between text-[length:var(--type-footnote-size)] text-[var(--color-text-muted)]">
                    <span>{order.table_name ?? order.order_type.replace('_', ' ')}</span>
                    <span>{order.server_name ?? 'Unknown'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[length:var(--type-footnote-size)] text-[var(--color-text-muted)]">
                      {order.guest_count} guest{order.guest_count !== 1 ? 's' : ''}
                    </span>
                    <div className="flex items-center gap-[var(--space-2)]">
                      {isPartiallyPaid && (
                        <Badge variant="warning" size="sm">
                          PARTIAL
                        </Badge>
                      )}
                      <MoneyDisplay
                        cents={orderTotal}
                        className="text-[length:var(--type-subhead-size)] font-[var(--weight-semibold)] text-[var(--color-text)] tabular-nums"
                      />
                    </div>
                  </div>
                </Card>
              )
            })
          )}
        </div>
      </div>

      {/* Right: Check actions */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[var(--color-bg)]">
        {!selectedOrder ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={SplitSquareHorizontal}
              title="Select a check"
              description="Tap an order on the left to manage the check"
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-y-auto p-[var(--space-4)] gap-[var(--space-4)]">
            {/* Check summary card */}
            <Card variant="elevated" padding="default">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[length:var(--type-title-3-size)] font-[var(--weight-semibold)] text-[var(--color-text)]">
                    #{selectedOrder.display_number || selectedOrder.order_number}
                  </h3>
                  <p className="text-[length:var(--type-subhead-size)] text-[var(--color-text-muted)]">
                    {selectedOrder.table_name ?? selectedOrder.order_type.replace('_', ' ')}
                    {' · '}
                    {selectedOrder.server_name ?? 'Unknown'}
                  </p>
                </div>
                <StatusBadge status={selectedOrder.status} />
              </div>

              {selectedOrder.order_items && selectedOrder.order_items.length > 0 && (
                <div className="divide-y divide-[var(--color-border)]">
                  {selectedOrder.order_items
                    .filter((i) => !i.is_voided)
                    .map((item) => (
                      <div key={item.id} className="flex items-start justify-between py-[var(--space-2)]">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-[var(--space-2)] flex-wrap">
                            <span className="text-[length:var(--type-subhead-size)] text-[var(--color-text)]">
                              {item.quantity > 1 && (
                                <span className="font-[var(--weight-semibold)] mr-1">{item.quantity}x</span>
                              )}
                              {item.name}
                            </span>
                            {item.seat_number && (
                              <Badge variant="default" size="sm">
                                S{item.seat_number}
                              </Badge>
                            )}
                            {item.is_comped && (
                              <Badge variant="warning" size="sm">
                                COMP
                              </Badge>
                            )}
                          </div>
                          {item.modifiers.length > 0 && (
                            <p className="pl-[var(--space-2)] text-[length:var(--type-footnote-size)] text-[var(--color-text-muted)]">
                              {item.modifiers.map((m) => m.name).join(', ')}
                            </p>
                          )}
                        </div>
                        <MoneyDisplay
                          cents={Math.round(parseFloat(item.line_total) * 100)}
                          className={cn(
                            'shrink-0 text-[length:var(--type-subhead-size)]',
                            item.is_comped && 'line-through text-[var(--color-text-muted)]'
                          )}
                        />
                      </div>
                    ))}
                </div>
              )}

              {/* Totals */}
              <div className="border-t border-[var(--color-border)] pt-[var(--space-3)] flex flex-col gap-[var(--space-1)]">
                <div className="flex justify-between text-[length:var(--type-subhead-size)]">
                  <span className="text-[var(--color-text-muted)]">Subtotal</span>
                  <MoneyDisplay
                    cents={Math.round(parseFloat(selectedOrder.subtotal) * 100)}
                    className="font-[var(--weight-medium)]"
                  />
                </div>
                {parseFloat(selectedOrder.discount_total) > 0 && (
                  <div className="flex justify-between text-[length:var(--type-subhead-size)]">
                    <span className="text-[var(--color-success)]">Discount</span>
                    <MoneyDisplay
                      cents={-Math.round(parseFloat(selectedOrder.discount_total) * 100)}
                      className="text-[var(--color-success)] font-[var(--weight-medium)]"
                    />
                  </div>
                )}
                <div className="flex justify-between text-[length:var(--type-subhead-size)]">
                  <span className="text-[var(--color-text-muted)]">Tax</span>
                  <MoneyDisplay
                    cents={Math.round(parseFloat(selectedOrder.tax_total) * 100)}
                    className="font-[var(--weight-medium)]"
                  />
                </div>
                <div className="flex justify-between border-t border-[var(--color-border)] pt-[var(--space-2)] mt-[var(--space-2)]">
                  <span className="text-[length:var(--type-headline-size)] font-[var(--weight-semibold)]">Total</span>
                  <MoneyDisplay
                    cents={totalCents}
                    className="text-[length:var(--type-title-3-size)] font-[var(--weight-semibold)]"
                  />
                </div>
                {amountPaidCents > 0 && (
                  <>
                    <div className="flex justify-between text-[length:var(--type-subhead-size)]">
                      <span className="text-[var(--color-success)]">Paid</span>
                      <MoneyDisplay
                        cents={amountPaidCents}
                        className="text-[var(--color-success)] font-[var(--weight-medium)]"
                      />
                    </div>
                    <div className="flex justify-between text-[length:var(--type-subhead-size)]">
                      <span className="font-[var(--weight-semibold)] text-[var(--color-danger)]">Balance Due</span>
                      <MoneyDisplay
                        cents={balanceDueCents}
                        className="font-[var(--weight-semibold)] text-[var(--color-danger)]"
                      />
                    </div>
                  </>
                )}
              </div>
            </Card>

            {/* Split Options */}
            <Card variant="elevated" padding="default">
              <h4 className="text-[length:var(--type-headline-size)] font-[var(--weight-semibold)] text-[var(--color-text)]">
                Split Check
              </h4>

              <Tabs
                variant="segmented"
                size="lg"
                items={SPLIT_MODE_TABS}
                value={splitMode}
                onValueChange={(v) => {
                  if (v === 'drag') {
                    handleDragSplit()
                  } else {
                    setSplitMode(v as SplitMode)
                  }
                }}
                ariaLabel="Split mode"
                fullWidth
              />

              {splitMode === 'equal' && (
                <div className="flex flex-col gap-[var(--space-3)]">
                  <p className="text-[length:var(--type-footnote-size)] text-[var(--color-text-muted)]">
                    Split the total evenly across checks
                  </p>
                  <div className="grid grid-cols-4 gap-[var(--space-2)]">
                    {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <Button
                        key={n}
                        variant={splitCount === n && isSplitting ? 'primary' : 'secondary'}
                        size="lg"
                        onClick={() => handleEqualSplit(n)}
                        disabled={isSplitting && splitCount !== n}
                        loading={splitCount === n && isSplitting}
                        className="h-[64px] flex flex-col items-center justify-center gap-0"
                      >
                        <span className="text-[length:var(--type-title-3-size)] font-[var(--weight-semibold)]">
                          {n}
                        </span>
                        <span className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">
                          <MoneyDisplay
                            cents={Math.round(totalCents / n)}
                            className="text-[length:var(--type-caption-1-size)]"
                          />{' '}
                          ea
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {splitMode === 'seat' && (
                <div className="flex flex-col gap-[var(--space-3)]">
                  <p className="text-[length:var(--type-footnote-size)] text-[var(--color-text-muted)]">
                    Each seat becomes a separate check. Items assigned to a seat go on that check.
                  </p>
                  <Button
                    variant="primary"
                    size="xl"
                    loading={isSplitting}
                    onClick={handleSeatSplit}
                    className="w-full"
                  >
                    {isSplitting ? 'Splitting' : 'Split by Seat'}
                  </Button>
                </div>
              )}

              {splitMode === 'custom' && (
                <div className="flex flex-col gap-[var(--space-3)]">
                  <p className="text-[length:var(--type-footnote-size)] text-[var(--color-text-muted)]">
                    Split a specific dollar amount to a new check. The remainder stays on this check.
                  </p>
                  <CustomAmountSplit
                    totalCents={totalCents}
                    orderId={selectedOrderId ?? ''}
                    onComplete={() => {
                      fetchOrders()
                      setSelectedOrderId(null)
                    }}
                  />
                </div>
              )}
            </Card>

            {/* Action buttons */}
            <div className="grid grid-cols-3 gap-[var(--space-3)]">
              <Button
                variant="secondary"
                size="xl"
                onClick={handlePrintCheck}
                leadingIcon={<Printer />}
                className="h-[72px] flex-col"
              >
                Print
              </Button>
              <Button
                variant="secondary"
                size="xl"
                onClick={handleMerge}
                leadingIcon={<Merge />}
                className="h-[72px] flex-col"
              >
                Merge
              </Button>
              <Button
                variant="primary"
                size="xl"
                onClick={handleProcessPayment}
                leadingIcon={<CreditCard />}
                className="h-[72px] flex-col bg-[var(--color-success)] hover:bg-[color-mix(in_srgb,var(--color-success)_85%,black)] active:bg-[color-mix(in_srgb,var(--color-success)_75%,black)]"
              >
                Pay
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

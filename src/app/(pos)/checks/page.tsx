'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
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
  ChevronRight,
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
  order_items?: OrderItem[]
}

type SplitMode = 'equal' | 'seat' | 'custom'

export default function ChecksPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<OrderSummary | null>(null)
  const [splitMode, setSplitMode] = useState<SplitMode>('equal')
  const [splitCount, setSplitCount] = useState<number | null>(null)
  const [isSplitting, setIsSplitting] = useState(false)

  // Fetch open orders
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

  // Fetch order details when selected
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

  // Handle equal split
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
          // Refresh orders list
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

  // Handle seat split
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

  // Handle print check
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
      // Fallback to browser print
      window.print()
    }
  }, [selectedOrderId])

  // Navigate to payment for selected order
  const handleProcessPayment = useCallback(() => {
    if (!selectedOrder) return
    const totalCents = Math.round(parseFloat(selectedOrder.balance_due || selectedOrder.total) * 100)
    router.push(`/payments?order_id=${selectedOrder.id}&total_cents=${totalCents}`)
  }, [selectedOrder, router])

  // Merge orders
  const handleMerge = useCallback(async () => {
    toast.info('Select a second order to merge into this one')
    // TODO: implement merge flow — need a second selection then call /api/orders/{id}/merge
  }, [])

  const totalCents = selectedOrder ? Math.round(parseFloat(selectedOrder.total) * 100) : 0
  const balanceDueCents = selectedOrder ? Math.round(parseFloat(selectedOrder.balance_due || selectedOrder.total) * 100) : 0
  const amountPaidCents = selectedOrder ? Math.round(parseFloat(selectedOrder.amount_paid || '0') * 100) : 0

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="flex h-full gap-0 no-select">
      {/* Left: Order list */}
      <div className="w-80 flex flex-col border-r border-border bg-white">
        <div className="shrink-0 px-3 py-3 border-b border-border">
          <h2 className="text-base font-bold text-foreground">Open Checks</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {orders.length} active order{orders.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide p-2 space-y-1.5">
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
              return (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setSelectedOrderId(isSelected ? null : order.id)}
                  className={cn(
                    'btn-press w-full rounded-xl border p-3 text-left transition-all duration-150',
                    isSelected
                      ? 'border-[var(--primary)] bg-[var(--accent)] shadow-warm-md'
                      : 'border-border bg-white shadow-warm-sm hover:shadow-warm-md'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-foreground">
                      #{order.display_number || order.order_number}
                    </span>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{order.table_name ?? order.order_type.replace('_', ' ')}</span>
                    <span>{order.server_name ?? 'Unknown'}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">
                      {order.guest_count} guest{order.guest_count !== 1 ? 's' : ''}
                    </span>
                    <MoneyDisplay cents={orderTotal} className="font-bold text-sm" />
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Right: Check actions */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[var(--background)]">
        {!selectedOrder ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={SplitSquareHorizontal}
              title="Select a check"
              description="Tap an order on the left to manage the check"
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-4">
            {/* Check summary */}
            <div className="rounded-xl border border-border bg-white p-4 shadow-warm-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    #{selectedOrder.display_number || selectedOrder.order_number}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedOrder.table_name ?? selectedOrder.order_type.replace('_', ' ')}
                    {' · '}
                    {selectedOrder.server_name ?? 'Unknown'}
                  </p>
                </div>
                <StatusBadge status={selectedOrder.status} />
              </div>

              {/* Order items */}
              {selectedOrder.order_items && selectedOrder.order_items.length > 0 && (
                <div className="mb-3 divide-y divide-border/50">
                  {selectedOrder.order_items
                    .filter((i) => !i.is_voided)
                    .map((item) => (
                      <div key={item.id} className="flex items-start justify-between py-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm text-foreground">
                              {item.quantity > 1 && (
                                <span className="font-bold mr-1">{item.quantity}x</span>
                              )}
                              {item.name}
                            </span>
                            {item.seat_number && (
                              <span className="text-[10px] text-muted-foreground bg-[var(--muted)] px-1 rounded">
                                S{item.seat_number}
                              </span>
                            )}
                            {item.is_comped && (
                              <span className="text-[10px] text-[var(--warning)] bg-[var(--warning-bg)] px-1 rounded font-bold">
                                COMP
                              </span>
                            )}
                          </div>
                          {item.modifiers.length > 0 && (
                            <p className="text-xs text-muted-foreground pl-2">
                              {item.modifiers.map((m) => m.name).join(', ')}
                            </p>
                          )}
                        </div>
                        <MoneyDisplay
                          cents={Math.round(parseFloat(item.line_total) * 100)}
                          className={cn('text-sm shrink-0', item.is_comped && 'line-through text-muted-foreground')}
                        />
                      </div>
                    ))}
                </div>
              )}

              {/* Totals */}
              <div className="border-t border-border pt-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <MoneyDisplay cents={Math.round(parseFloat(selectedOrder.subtotal) * 100)} className="font-medium" />
                </div>
                {parseFloat(selectedOrder.discount_total) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--success)]">Discount</span>
                    <MoneyDisplay cents={-Math.round(parseFloat(selectedOrder.discount_total) * 100)} className="text-[var(--success)] font-medium" />
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <MoneyDisplay cents={Math.round(parseFloat(selectedOrder.tax_total) * 100)} className="font-medium" />
                </div>
                <div className="flex justify-between border-t border-border pt-2 mt-2">
                  <span className="text-base font-bold">Total</span>
                  <MoneyDisplay cents={totalCents} className="text-lg font-bold" />
                </div>
                {amountPaidCents > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--success)]">Paid</span>
                      <MoneyDisplay cents={amountPaidCents} className="text-[var(--success)] font-medium" />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-[var(--error)]">Balance Due</span>
                      <MoneyDisplay cents={balanceDueCents} className="font-bold text-[var(--error)]" />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Split Options */}
            <div className="rounded-xl border border-border bg-white p-4 shadow-warm-sm">
              <h4 className="text-sm font-bold text-foreground mb-3">Split Check</h4>

              {/* Split mode tabs */}
              <div className="flex gap-1.5 mb-4">
                {([
                  { key: 'equal' as const, icon: Users, label: 'Equal Split' },
                  { key: 'seat' as const, icon: SplitSquareHorizontal, label: 'By Seat' },
                  { key: 'custom' as const, icon: ArrowRightLeft, label: 'Custom' },
                ]).map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSplitMode(key)}
                    className={cn(
                      'btn-press flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-3 text-xs font-semibold transition-all',
                      splitMode === key
                        ? 'border-[var(--primary)] bg-[var(--accent)] text-[var(--primary)]'
                        : 'border-border bg-white text-muted-foreground hover:bg-[var(--secondary)]'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Equal split: number grid */}
              {splitMode === 'equal' && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Split the total evenly across checks
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => handleEqualSplit(n)}
                        disabled={isSplitting}
                        className={cn(
                          'btn-press flex flex-col items-center justify-center h-16 rounded-xl border text-center transition-all',
                          splitCount === n && isSplitting
                            ? 'border-[var(--primary)] bg-[var(--accent)]'
                            : 'border-border bg-white hover:bg-[var(--secondary)]',
                          isSplitting && splitCount !== n && 'opacity-40'
                        )}
                      >
                        <span className="text-lg font-bold text-foreground">{n}</span>
                        <span className="text-[10px] text-muted-foreground">
                          <MoneyDisplay cents={Math.round(totalCents / n)} className="text-[10px]" /> ea
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Seat split */}
              {splitMode === 'seat' && (
                <div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Each seat becomes a separate check. Items assigned to a seat go on that check.
                  </p>
                  <button
                    type="button"
                    onClick={handleSeatSplit}
                    disabled={isSplitting}
                    className="btn-press touch-target-lg w-full h-14 rounded-xl bg-[var(--primary)] text-white text-base font-semibold transition-all hover:bg-[var(--primary-hover)] disabled:opacity-40"
                  >
                    {isSplitting ? 'Splitting...' : 'Split by Seat'}
                  </button>
                </div>
              )}

              {/* Custom split */}
              {splitMode === 'custom' && (
                <div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Drag items between checks to create custom splits.
                  </p>
                  <p className="text-xs text-[var(--warning)] font-medium">
                    Custom item-drag split coming in next update. Use equal or seat split for now.
                  </p>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handlePrintCheck}
                className="btn-press touch-target-lg flex h-14 items-center justify-center gap-2 rounded-xl border border-border bg-white text-sm font-semibold text-foreground shadow-warm-sm transition-all hover:shadow-warm-md"
              >
                <Printer className="h-5 w-5 text-muted-foreground" />
                Print Check
              </button>
              <button
                type="button"
                onClick={handleProcessPayment}
                className="btn-press touch-target-lg flex h-14 items-center justify-center gap-2 rounded-xl bg-[var(--success)] text-white text-sm font-semibold shadow-warm-md transition-all hover:bg-green-600"
              >
                <CreditCard className="h-5 w-5" />
                Process Payment
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

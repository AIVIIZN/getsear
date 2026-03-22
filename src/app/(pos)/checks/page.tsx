'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/shared/EmptyState'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Receipt, SplitSquareHorizontal, Users, ArrowRightLeft } from 'lucide-react'

interface OrderSummary {
  id: string
  order_number: string
  order_type: string
  status: string
  table_name: string | null
  server_name: string
  guest_count: number
  item_count: number
  subtotal: number
  tax: number
  total: number
  created_at: string
}

export default function ChecksPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null)

  useEffect(() => {
    async function fetchOrders() {
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
    }
    fetchOrders()
  }, [])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="flex h-full gap-4 p-4 no-select">
      {/* Left: Order list */}
      <div className="w-80 flex flex-col gap-2 overflow-y-auto scrollbar-hide">
        <h2 className="text-lg font-semibold px-1">Open Checks</h2>
        <Separator />
        {orders.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No open checks"
            description="Active orders will appear here for check management"
          />
        ) : (
          orders.map((order) => (
            <Card
              key={order.id}
              className={`cursor-pointer transition-all btn-press ${
                selectedOrder === order.id
                  ? 'ring-2 ring-[var(--primary)] shadow-warm-md'
                  : 'shadow-warm-sm hover:shadow-warm-md'
              }`}
              onClick={() => setSelectedOrder(order.id)}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm">#{order.order_number}</span>
                  <StatusBadge status={order.status} />
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                  <span>{order.table_name ?? order.order_type}</span>
                  <span>{order.server_name}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {order.item_count} items · {order.guest_count} guests
                  </span>
                  <MoneyDisplay cents={Math.round(order.total * 100)} className="font-semibold text-sm" />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Right: Check actions */}
      <div className="flex-1 flex flex-col">
        {!selectedOrder ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={SplitSquareHorizontal}
              title="Select a check"
              description="Tap an order on the left to manage the check"
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4">
            <Card className="shadow-warm-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Split Options</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="equal">
                  <TabsList className="w-full">
                    <TabsTrigger value="equal" className="flex-1 touch-target">
                      <Users className="h-4 w-4 mr-2" />
                      Equal Split
                    </TabsTrigger>
                    <TabsTrigger value="seat" className="flex-1 touch-target">
                      <SplitSquareHorizontal className="h-4 w-4 mr-2" />
                      By Seat
                    </TabsTrigger>
                    <TabsTrigger value="custom" className="flex-1 touch-target">
                      <ArrowRightLeft className="h-4 w-4 mr-2" />
                      Custom
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="equal" className="mt-4">
                    <div className="grid grid-cols-4 gap-2">
                      {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                        <Button
                          key={n}
                          variant="outline"
                          className="h-14 text-lg font-semibold btn-press touch-target-lg"
                        >
                          {n}
                        </Button>
                      ))}
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)] mt-3">
                      Split the total evenly across the selected number of checks
                    </p>
                  </TabsContent>
                  <TabsContent value="seat" className="mt-4">
                    <p className="text-sm text-[var(--muted-foreground)]">
                      Each seat becomes a separate check. Items assigned to a seat go on that check.
                    </p>
                    <Button className="mt-4 btn-press touch-target">
                      Split by Seat
                    </Button>
                  </TabsContent>
                  <TabsContent value="custom" className="mt-4">
                    <p className="text-sm text-[var(--muted-foreground)]">
                      Drag items between checks to create custom splits.
                    </p>
                    <Button className="mt-4 btn-press touch-target">
                      Start Custom Split
                    </Button>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-14 btn-press touch-target-lg">
                <Receipt className="h-5 w-5 mr-2" />
                Print Check
              </Button>
              <Button className="h-14 btn-press touch-target-lg">
                Process Payment
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

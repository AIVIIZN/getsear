'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Clock, Check, X, RefreshCw, ShoppingBag, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface QueueOrder {
  id: string
  order_id: string
  status: string
  customer_name: string
  customer_phone: string
  order_type: string
  total: string
  item_count: number
  items_summary: string
  scheduled_for: string | null
  created_at: string
}

export function OrderQueuePanel() {
  const [orders, setOrders] = useState<QueueOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/online-ordering/queue')
      const json = await res.json()
      if (res.ok) setOrders(json.data ?? [])
    } catch {
      toast.error('Failed to load order queue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQueue()
    const interval = setInterval(fetchQueue, 15000) // Refresh every 15s
    return () => clearInterval(interval)
  }, [fetchQueue])

  const handleAccept = async (orderId: string) => {
    setProcessing(orderId)
    try {
      const res = await fetch(`/api/online-ordering/queue/${orderId}/accept`, {
        method: 'POST',
      })
      if (res.ok) {
        toast.success('Order accepted - sent to KDS')
        fetchQueue()
      } else {
        const json = await res.json()
        toast.error(json.error ?? 'Failed to accept order')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setProcessing(null)
    }
  }

  const handleReject = async (orderId: string) => {
    setProcessing(orderId)
    try {
      const res = await fetch(`/api/online-ordering/queue/${orderId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Unable to fulfill at this time' }),
      })
      if (res.ok) {
        toast.success('Order rejected')
        fetchQueue()
      } else {
        const json = await res.json()
        toast.error(json.error ?? 'Failed to reject order')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setProcessing(null)
    }
  }

  const pendingOrders = orders.filter((o) => o.status === 'pending')
  const acceptedOrders = orders.filter((o) => o.status === 'accepted')

  if (loading) {
    return <Skeleton className="h-64 rounded-xl" />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <ShoppingBag className="h-4 w-4" />
          Online Order Queue
          {pendingOrders.length > 0 && (
            <Badge className="bg-orange-500 text-white border-none animate-pulse">
              {pendingOrders.length} new
            </Badge>
          )}
        </h3>
        <Button variant="ghost" size="sm" onClick={fetchQueue} className="h-8 w-8 p-0">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Pending Orders */}
      {pendingOrders.length === 0 && acceptedOrders.length === 0 ? (
        <Card className="border-warm shadow-warm">
          <CardContent className="py-8 text-center">
            <ShoppingBag className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No online orders in queue</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pendingOrders.map((order) => {
            const minutesAgo = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)
            return (
              <Card
                key={order.id}
                className="border-orange-200 bg-orange-50/30 shadow-warm"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{order.customer_name}</p>
                        <Badge variant="outline" className="text-[10px] bg-orange-100 text-orange-700 border-orange-200">
                          New
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">${order.total}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                        <Clock className="h-3 w-3" />
                        {minutesAgo}m ago
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mb-3">{order.items_summary}</p>

                  {order.scheduled_for && (
                    <p className="text-xs text-blue-600 mb-2">
                      Scheduled for: {new Date(order.scheduled_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleAccept(order.order_id)}
                      disabled={processing === order.order_id}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    >
                      {processing === order.order_id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      ) : (
                        <Check className="h-3.5 w-3.5 mr-1" />
                      )}
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(order.order_id)}
                      disabled={processing === order.order_id}
                      className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}

          {/* Accepted Orders */}
          {acceptedOrders.map((order) => (
            <Card key={order.id} className="border-green-200 bg-green-50/30 shadow-warm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{order.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{order.items_summary}</p>
                  </div>
                  <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
                    Accepted
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

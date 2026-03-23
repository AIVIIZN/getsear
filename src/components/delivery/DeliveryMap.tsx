'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { MapPin, Navigation, Phone, Clock, Package, Truck, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface Delivery {
  id: string
  customer_name: string
  customer_phone: string
  delivery_address: string
  status: string
  driver_name: string | null
  driver_lat: number | null
  driver_lng: number | null
  order_total: string
  created_at: string
}

interface Driver {
  id: string
  name: string
  status: string
  current_lat: number | null
  current_lng: number | null
  active_deliveries: number
  completed_today: number
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  assigned: 'bg-blue-50 text-blue-700 border-blue-200',
  picked_up: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  en_route: 'bg-orange-50 text-orange-700 border-orange-200',
  delivered: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
}

export function DeliveryMap() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [delRes, drvRes] = await Promise.all([
        fetch('/api/delivery/deliveries'),
        fetch('/api/delivery/zones'), // Reuse for drivers
      ])
      const [delJson, drvJson] = await Promise.all([delRes.json(), drvRes.json()])
      setDeliveries(delJson.data ?? [])
      setDrivers(drvJson.drivers ?? [])
    } catch {
      toast.error('Failed to load delivery data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [fetchData])

  const activeDeliveries = deliveries.filter((d) =>
    ['pending', 'assigned', 'picked_up', 'en_route'].includes(d.status)
  )
  const completedToday = deliveries.filter((d) => d.status === 'delivered').length
  const avgTime = 0 // Would compute from actual data

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-warm shadow-warm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Active</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">{activeDeliveries.length}</p>
              </div>
              <div className="rounded-lg p-2 bg-orange-50">
                <Truck className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-warm shadow-warm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase">Completed Today</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{completedToday}</p>
          </CardContent>
        </Card>
        <Card className="border-warm shadow-warm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase">Drivers Online</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{drivers.filter((d) => d.status !== 'offline').length}</p>
          </CardContent>
        </Card>
        <Card className="border-warm shadow-warm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase">Avg Time</p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">{avgTime || '--'}m</p>
          </CardContent>
        </Card>
      </div>

      {/* Map Placeholder + Active Deliveries */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <Card className="border-warm shadow-warm lg:col-span-2">
          <CardContent className="p-0">
            <div className="h-96 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-10">
                {/* Grid pattern for map placeholder */}
                <div className="w-full h-full" style={{
                  backgroundImage: 'radial-gradient(circle, #ccc 1px, transparent 1px)',
                  backgroundSize: '30px 30px',
                }} />
              </div>
              {/* Driver dots */}
              {drivers.filter((d) => d.current_lat).map((driver, i) => (
                <div
                  key={driver.id}
                  className="absolute"
                  style={{
                    left: `${30 + i * 15}%`,
                    top: `${20 + i * 20}%`,
                  }}
                >
                  <div className={`w-4 h-4 rounded-full ${driver.status === 'on_delivery' ? 'bg-orange-500 animate-pulse' : 'bg-green-500'} border-2 border-white shadow`} />
                  <p className="text-[9px] font-medium mt-0.5 whitespace-nowrap">{driver.name}</p>
                </div>
              ))}
              <div className="z-10 text-center">
                <MapPin className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400 font-medium">GPS Tracking Map</p>
                <p className="text-xs text-gray-300">Requires Mapbox/Leaflet integration</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Queue */}
        <Card className="border-warm shadow-warm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Active Deliveries</CardTitle>
              <Button variant="ghost" size="sm" onClick={fetchData} className="h-8 w-8 p-0">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {activeDeliveries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No active deliveries</p>
            ) : (
              activeDeliveries.map((del) => (
                <div key={del.id} className="rounded-lg border border-border/50 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{del.customer_name}</p>
                    <Badge variant="outline" className={STATUS_STYLES[del.status] ?? ''}>
                      {del.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {del.delivery_address}
                  </p>
                  {del.driver_name && (
                    <p className="text-xs text-blue-600 flex items-center gap-1">
                      <Navigation className="h-3 w-3" />
                      {del.driver_name}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>${del.order_total}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(del.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Drivers */}
      <Card className="border-warm shadow-warm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Drivers</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {drivers.map((driver) => (
              <div key={driver.id} className="rounded-lg border p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    driver.status === 'available' ? 'bg-green-500' :
                    driver.status === 'on_delivery' ? 'bg-orange-500 animate-pulse' :
                    'bg-gray-300'
                  }`} />
                  <p className="font-medium text-sm">{driver.name}</p>
                </div>
                <p className="text-xs text-muted-foreground capitalize">{driver.status.replace(/_/g, ' ')}</p>
                <p className="text-xs text-muted-foreground">{driver.completed_today} completed today</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

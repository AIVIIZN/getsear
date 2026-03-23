'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Car, Timer, Plus, ArrowRight, RefreshCw, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface CarData {
  id: string
  order_id: string | null
  position: 'ordering' | 'payment' | 'pickup'
  entered_at: string
}

interface Lane {
  id: string
  number: number
  name: string
  is_active: boolean
  cars: CarData[]
  car_count: number
}

interface SpeedMetrics {
  avg_total_time: number
  avg_menu_time: number
  avg_payment_time: number
  avg_pickup_time: number
  cars_per_hour: number
  target_total_time: number
  total_cars: number
}

const POSITION_COLORS = {
  ordering: 'bg-blue-500',
  payment: 'bg-orange-500',
  pickup: 'bg-green-500',
}

const POSITION_LABELS = {
  ordering: 'Menu Board',
  payment: 'Payment Window',
  pickup: 'Pickup Window',
}

function formatSeconds(seconds: number): string {
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  return `${min}:${String(sec).padStart(2, '0')}`
}

export function LaneDisplay() {
  const [lanes, setLanes] = useState<Lane[]>([])
  const [metrics, setMetrics] = useState<SpeedMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [lanesRes, metricsRes] = await Promise.all([
        fetch('/api/drive-thru/lanes'),
        fetch('/api/drive-thru/speed-metrics'),
      ])
      const [lanesJson, metricsJson] = await Promise.all([lanesRes.json(), metricsRes.json()])
      setLanes(lanesJson.data ?? [])
      setMetrics(metricsJson.data ?? null)
    } catch {
      toast.error('Failed to load drive-thru data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleAddCar = async (laneId: string) => {
    try {
      const res = await fetch('/api/drive-thru/lanes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lane_id: laneId }),
      })
      if (res.ok) {
        fetchData()
      }
    } catch {
      toast.error('Failed to add car')
    }
  }

  const handleAdvanceCar = async (laneId: string, carId: string, nextPosition: 'payment' | 'pickup') => {
    try {
      await fetch(`/api/drive-thru/lanes/${laneId}/cars`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ car_id: carId, position: nextPosition }),
      })
      fetchData()
    } catch {
      toast.error('Failed to advance car')
    }
  }

  const handleExitCar = async (laneId: string, carId: string) => {
    try {
      await fetch(`/api/drive-thru/lanes/${laneId}/cars`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ car_id: carId, exit: true }),
      })
      toast.success('Car completed')
      fetchData()
    } catch {
      toast.error('Failed to exit car')
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  const isOverTarget = metrics && metrics.avg_total_time > metrics.target_total_time

  return (
    <div className="space-y-6">
      {/* Speed Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className={`border-warm shadow-warm ${isOverTarget ? 'ring-2 ring-red-200' : ''}`}>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Avg Total</p>
            <p className={`text-xl font-bold ${isOverTarget ? 'text-red-600' : 'text-green-600'}`}>
              {metrics ? formatSeconds(metrics.avg_total_time) : '--'}
            </p>
            <p className="text-[10px] text-muted-foreground">Target: {metrics ? formatSeconds(metrics.target_total_time) : '3:30'}</p>
          </CardContent>
        </Card>
        <Card className="border-warm shadow-warm">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Menu Board</p>
            <p className="text-xl font-bold text-blue-600">
              {metrics ? formatSeconds(metrics.avg_menu_time) : '--'}
            </p>
          </CardContent>
        </Card>
        <Card className="border-warm shadow-warm">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Payment</p>
            <p className="text-xl font-bold text-orange-600">
              {metrics ? formatSeconds(metrics.avg_payment_time) : '--'}
            </p>
          </CardContent>
        </Card>
        <Card className="border-warm shadow-warm">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Pickup</p>
            <p className="text-xl font-bold text-green-600">
              {metrics ? formatSeconds(metrics.avg_pickup_time) : '--'}
            </p>
          </CardContent>
        </Card>
        <Card className="border-warm shadow-warm">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Cars/Hour</p>
            <p className="text-xl font-bold text-indigo-600">
              {metrics?.cars_per_hour ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lane Displays */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {lanes.map((lane) => (
          <Card key={lane.id} className="border-warm shadow-warm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${lane.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                  {lane.name}
                  <Badge variant="outline" className="text-[10px]">{lane.car_count} cars</Badge>
                </CardTitle>
                <Button size="sm" variant="outline" onClick={() => handleAddCar(lane.id)} className="h-7 px-2 text-xs">
                  <Plus className="h-3 w-3 mr-1" />
                  Car
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {/* Visual Lane */}
              <div className="relative bg-gray-100 rounded-xl p-3 min-h-[120px]">
                <div className="flex justify-between mb-4">
                  {(['ordering', 'payment', 'pickup'] as const).map((pos) => (
                    <div key={pos} className="text-center flex-1">
                      <p className="text-[9px] font-medium text-gray-500 uppercase">{POSITION_LABELS[pos]}</p>
                    </div>
                  ))}
                </div>

                {/* Lane track */}
                <div className="relative h-12 bg-gray-200 rounded-lg flex items-center">
                  <div className="absolute inset-0 flex">
                    <div className="flex-1 border-r border-dashed border-gray-300" />
                    <div className="flex-1 border-r border-dashed border-gray-300" />
                    <div className="flex-1" />
                  </div>

                  {/* Cars */}
                  {lane.cars.map((car) => {
                    const positionOffset =
                      car.position === 'ordering' ? '10%' :
                      car.position === 'payment' ? '43%' : '77%'

                    const waitSeconds = Math.floor((Date.now() - new Date(car.entered_at).getTime()) / 1000)

                    return (
                      <div
                        key={car.id}
                        className="absolute z-10 transition-all duration-500"
                        style={{ left: positionOffset }}
                      >
                        <button
                          onClick={() => {
                            if (car.position === 'ordering') handleAdvanceCar(lane.id, car.id, 'payment')
                            else if (car.position === 'payment') handleAdvanceCar(lane.id, car.id, 'pickup')
                            else handleExitCar(lane.id, car.id)
                          }}
                          className={`w-10 h-8 rounded ${POSITION_COLORS[car.position]} text-white flex items-center justify-center shadow-md hover:opacity-80 transition-opacity`}
                          title={`Click to ${car.position === 'pickup' ? 'complete' : 'advance'}`}
                        >
                          <Car className="h-4 w-4" />
                        </button>
                        <p className="text-[8px] text-center text-gray-500 mt-0.5">
                          {formatSeconds(waitSeconds)}
                        </p>
                      </div>
                    )
                  })}
                </div>

                {lane.cars.length === 0 && (
                  <p className="text-xs text-gray-400 text-center mt-2">No cars in lane</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-500" /> Menu Board</span>
        <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-orange-500" /> Payment</span>
        <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-500" /> Pickup</span>
        <span className="ml-auto">Click car to advance &rarr;</span>
      </div>
    </div>
  )
}

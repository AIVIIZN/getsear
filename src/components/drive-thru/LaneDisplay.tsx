'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Car, Plus } from 'lucide-react'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui-v2/Card'
import { Badge } from '@/components/ui-v2/data/Badge'
import { Stat } from '@/components/ui-v2/data/Stat'
import { Skeleton } from '@/components/ui-v2/data/Skeleton'
import { Button } from '@/components/ui/button'

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

const POSITION_LABELS = {
  ordering: 'Menu Board',
  payment: 'Payment Window',
  pickup: 'Pickup Window',
}

const POSITION_TOKEN_BG: Record<CarData['position'], string> = {
  ordering: 'bg-[var(--color-primary)]',
  payment: 'bg-[var(--color-warning-strong)]',
  pickup: 'bg-[var(--color-success-strong)]',
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} variant="card" className="h-24" />)}
        </div>
        <Skeleton variant="chart" className="h-64" />
      </div>
    )
  }

  const isOverTarget = !!metrics && metrics.avg_total_time > metrics.target_total_time
  const activeLaneCount = lanes.filter((l) => l.is_active).length

  return (
    <div className="space-y-6">
      {/* Speed Metrics — ui-v2 Stat + Card */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card variant={isOverTarget ? 'flat' : 'elevated'} padding="compact">
          <Stat
            label="Avg Total"
            value={
              <span className={isOverTarget ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}>
                {metrics ? formatSeconds(metrics.avg_total_time) : '--'}
              </span>
            }
            delta={metrics ? {
              value: `Target ${formatSeconds(metrics.target_total_time)}`,
              direction: isOverTarget ? 'up' : 'flat',
              intent: isOverTarget ? 'negative' : 'auto',
            } : undefined}
          />
        </Card>
        <Card variant="elevated" padding="compact">
          <Stat
            label="Menu Board"
            value={
              <span className="text-[var(--color-primary)]">
                {metrics ? formatSeconds(metrics.avg_menu_time) : '--'}
              </span>
            }
          />
        </Card>
        <Card variant="elevated" padding="compact">
          <Stat
            label="Payment"
            value={
              <span className="text-[var(--color-warning)]">
                {metrics ? formatSeconds(metrics.avg_payment_time) : '--'}
              </span>
            }
          />
        </Card>
        <Card variant="elevated" padding="compact">
          <Stat
            label="Pickup"
            value={
              <span className="text-[var(--color-success)]">
                {metrics ? formatSeconds(metrics.avg_pickup_time) : '--'}
              </span>
            }
          />
        </Card>
        <Card variant="elevated" padding="compact">
          <Stat
            label="Active Lanes"
            value={
              <span className="text-[var(--color-text)]">
                {activeLaneCount}
              </span>
            }
            delta={{
              value: `${metrics?.cars_per_hour ?? 0} cars/hr`,
              direction: 'flat',
            }}
          />
        </Card>
      </div>

      {/* Lane Displays */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {lanes.map((lane) => (
          <Card
            key={lane.id}
            variant={lane.is_active ? 'elevated' : 'flat'}
            padding="compact"
            className="gap-[var(--space-3)]"
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-[var(--space-2)] text-[length:var(--type-subhead-size)]">
                  <span
                    className={`h-[10px] w-[10px] rounded-[var(--radius-circle)] ${
                      lane.is_active
                        ? 'bg-[var(--color-success-strong)]'
                        : 'bg-[var(--color-border-strong)]'
                    }`}
                    aria-hidden="true"
                  />
                  {lane.name}
                  <Badge
                    variant={lane.car_count > 0 ? 'primary' : 'default'}
                    size="sm"
                  >
                    {lane.car_count} {lane.car_count === 1 ? 'car' : 'cars'}
                  </Badge>
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddCar(lane.id)}
                  className="h-7 px-2 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Car
                </Button>
              </div>
            </CardHeader>
            <CardBody>
              {/* Visual Lane */}
              <div className="relative bg-[var(--color-bg-muted)] rounded-[var(--radius-md)] p-[var(--space-3)] min-h-[120px]">
                <div className="flex justify-between mb-[var(--space-4)]">
                  {(['ordering', 'payment', 'pickup'] as const).map((pos) => (
                    <div key={pos} className="text-center flex-1">
                      <p className="text-[9px] font-[var(--weight-medium)] uppercase tracking-wide text-[var(--color-text-muted)]">
                        {POSITION_LABELS[pos]}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Lane track */}
                <div className="relative h-12 bg-[var(--color-bg-subtle)] rounded-[var(--radius-sm)] flex items-center border border-[var(--color-border)]">
                  <div className="absolute inset-0 flex">
                    <div className="flex-1 border-r border-dashed border-[var(--color-border-strong)]" />
                    <div className="flex-1 border-r border-dashed border-[var(--color-border-strong)]" />
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
                        className="absolute z-10 transition-all duration-[var(--duration-base)] ease-[var(--ease-spring)]"
                        style={{ left: positionOffset }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (car.position === 'ordering') handleAdvanceCar(lane.id, car.id, 'payment')
                            else if (car.position === 'payment') handleAdvanceCar(lane.id, car.id, 'pickup')
                            else handleExitCar(lane.id, car.id)
                          }}
                          className={`btn-press w-10 h-8 rounded-[var(--radius-sm)] ${POSITION_TOKEN_BG[car.position]} text-[var(--color-primary-fg)] flex items-center justify-center shadow-[var(--shadow-low)] hover:opacity-90 transition-opacity`}
                          title={`Click to ${car.position === 'pickup' ? 'complete' : 'advance'}`}
                        >
                          <Car className="h-4 w-4" />
                        </button>
                        <p className="text-[8px] text-center text-[var(--color-text-muted)] mt-0.5 tabular-nums">
                          {formatSeconds(waitSeconds)}
                        </p>
                      </div>
                    )
                  })}
                </div>

                {lane.cars.length === 0 && (
                  <p className="text-[var(--type-caption-1-size)] text-[var(--color-text-subtle)] text-center mt-[var(--space-2)]">
                    No cars in lane
                  </p>
                )}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-[var(--space-4)] text-[var(--type-caption-1-size)] text-[var(--color-text-muted)]">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-[var(--radius-xs)] bg-[var(--color-primary)]" />
          Menu Board
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-[var(--radius-xs)] bg-[var(--color-warning-strong)]" />
          Payment
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-[var(--radius-xs)] bg-[var(--color-success-strong)]" />
          Pickup
        </span>
        <span className="ml-auto">Click car to advance &rarr;</span>
      </div>
    </div>
  )
}

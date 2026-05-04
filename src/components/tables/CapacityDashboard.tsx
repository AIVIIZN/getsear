'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Users, Armchair, Clock, BarChart3, CalendarDays, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { calculateAverageTurnTime } from '@/lib/tables/turn-time-calc'
import { EmptyState } from '@/components/ui-v2/feedback/EmptyState'

interface TableData {
  id: string
  name: string
  capacity: number
  status: string
  guest_count: number
  seated_at: string | null
}

interface UpcomingReservation {
  id: string
  customer_name: string
  party_size: number
  reservation_time: string
  table_id: string | null
  table_name?: string | null
  status: string
}

interface CapacityDashboardProps {
  tables: TableData[]
  className?: string
  onSeatReservation?: (reservation: UpcomingReservation) => void
}

const OCCUPIED_STATUSES = ['seated', 'ordered', 'served', 'check_presented', 'dessert']

/**
 * Real-time capacity overview: KPI cards, occupancy bar, upcoming reservations.
 */
export function CapacityDashboard({
  tables,
  className,
  onSeatReservation,
}: CapacityDashboardProps) {
  const [reservations, setReservations] = useState<UpcomingReservation[]>([])
  const [loadingRes, setLoadingRes] = useState(true)
  const [turnTimeRecords, setTurnTimeRecords] = useState<
    Array<{ seated_at: string; cleared_at: string }>
  >([])

  // Fetch upcoming reservations (next 2 hours)
  const fetchUpcoming = useCallback(async () => {
    setLoadingRes(true)
    try {
      const now = new Date()
      const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000)
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

      const res = await fetch(
        `/api/reservations?date_from=${today}&date_to=${today}&limit=50`
      )
      if (res.ok) {
        const json = await res.json()
        const allRes = (json.data ?? []) as Array<{
          id: string
          customer_name: string
          party_size: number
          reservation_time: string
          table_id: string | null
          status: string
        }>

        // Filter to upcoming (within 2 hours) and not yet completed
        const upcoming = allRes.filter((r) => {
          if (['completed', 'cancelled', 'no_show', 'seated'].includes(r.status)) return false
          const [h, m] = r.reservation_time.split(':').map(Number)
          const resTime = new Date(now)
          resTime.setHours(h, m, 0, 0)
          return resTime >= new Date(now.getTime() - 15 * 60000) && resTime <= twoHoursLater
        })

        setReservations(upcoming)
      }
    } finally {
      setLoadingRes(false)
    }
  }, [])

  // Fetch today's turn time data for average calculation
  const fetchTurnTimes = useCallback(async () => {
    try {
      const today = new Date()
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      const res = await fetch(
        `/api/tables/turn-times?date_from=${dateStr}&date_to=${dateStr}&group_by=daypart`
      )
      if (res.ok) {
        const json = await res.json()
        setTurnTimeRecords(json.data?.summary ? [{ seated_at: '', cleared_at: '' }] : [])
        // Store the average from the API
        if (json.data?.summary?.avg_turn_time) {
          setTurnTimeRecords(
            Array(json.data.summary.total_turns).fill({
              seated_at: new Date(Date.now() - json.data.summary.avg_turn_time * 60000).toISOString(),
              cleared_at: new Date().toISOString(),
            })
          )
        }
      }
    } catch {
      // Silently fail
    }
  }, [])

  useEffect(() => {
    fetchUpcoming()
    fetchTurnTimes()
    const interval = setInterval(fetchUpcoming, 60000)
    return () => clearInterval(interval)
  }, [fetchUpcoming, fetchTurnTimes])

  // Calculate KPIs
  const totalSeats = useMemo(
    () => tables.reduce((sum, t) => sum + t.capacity, 0),
    [tables]
  )

  const occupiedSeats = useMemo(
    () =>
      tables
        .filter((t) => OCCUPIED_STATUSES.includes(t.status))
        .reduce((sum, t) => sum + (t.guest_count || 0), 0),
    [tables]
  )

  const availableTables = useMemo(
    () => tables.filter((t) => t.status === 'available').length,
    [tables]
  )

  const avgTurnTime = useMemo(
    () =>
      turnTimeRecords.length > 0
        ? calculateAverageTurnTime(
            turnTimeRecords.filter((r) => r.seated_at && r.cleared_at)
          )
        : 0,
    [turnTimeRecords]
  )

  const occupancyPercent =
    totalSeats > 0 ? Math.round((occupiedSeats / totalSeats) * 100) : 0

  // Occupancy bar color
  const barColor =
    occupancyPercent >= 90
      ? 'bg-red-500'
      : occupancyPercent >= 70
        ? 'bg-amber-500'
        : 'bg-emerald-500'

  const formatTime = (time: string) => {
    const [h, m] = time.split(':')
    const hour = parseInt(h, 10)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${h12}:${m} ${ampm}`
  }

  const STATUS_BADGE: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={Armchair}
          label="Total Seats"
          value={String(totalSeats)}
          iconColor="text-blue-600"
        />
        <KpiCard
          icon={Users}
          label="Occupied"
          value={`${occupiedSeats} (${occupancyPercent}%)`}
          iconColor="text-emerald-600"
        />
        <KpiCard
          icon={BarChart3}
          label="Available Tables"
          value={String(availableTables)}
          iconColor="text-amber-600"
        />
        <KpiCard
          icon={Clock}
          label="Avg Turn Time"
          value={avgTurnTime > 0 ? `${avgTurnTime} min` : '--'}
          iconColor="text-purple-600"
        />
      </div>

      {/* Occupancy Bar */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Capacity</span>
          <span className="text-sm font-bold tabular-nums text-foreground">
            {occupancyPercent}%
          </span>
        </div>
        <div className="relative h-4 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              barColor
            )}
            style={{ width: `${occupancyPercent}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Upcoming Reservations */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              Upcoming Reservations (next 2 hours)
            </span>
          </div>
          <Badge variant="secondary" className="px-1.5 py-0 text-xs">
            {reservations.length}
          </Badge>
        </div>

        {loadingRes ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : reservations.length === 0 ? (
          <EmptyState
            illustration="no-reservations"
            title="No upcoming reservations"
            description="No bookings in the next 2 hours."
          />
        ) : (
          <div className="divide-y divide-border">
            {reservations.map((res) => (
              <div
                key={res.id}
                className="flex items-center gap-3 p-3"
              >
                <span className="w-16 text-sm font-medium tabular-nums text-foreground">
                  {formatTime(res.reservation_time)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {res.customer_name}, party {res.party_size}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {res.table_name ? `Table ${res.table_name}` : 'No table assigned'}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px]',
                    STATUS_BADGE[res.status] ?? ''
                  )}
                >
                  {res.status}
                </Badge>
                <Button
                  size="sm"
                  className="h-8 touch-target px-3 text-xs"
                  onClick={() => onSeatReservation?.(res)}
                >
                  {res.table_id ? 'Seat' : 'Assign'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  iconColor,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  iconColor: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', iconColor)} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Plus, DollarSign, Clock, Users, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface Shift {
  id: string
  staff_id: string
  staff_name: string
  role: string
  date: string
  start_time: string
  end_time: string
  hours: number
  color: string
}

interface LaborForecast {
  total_hours: number
  total_cost: number
  projected_sales: number
  labor_pct: number
  target_pct: number
  is_over_target: boolean
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const ROLE_COLORS: Record<string, string> = {
  server: 'bg-blue-100 text-blue-800 border-blue-200',
  bartender: 'bg-purple-100 text-purple-800 border-purple-200',
  kitchen: 'bg-green-100 text-green-800 border-green-200',
  host: 'bg-orange-100 text-orange-800 border-orange-200',
  manager: 'bg-red-100 text-red-800 border-red-200',
  busser: 'bg-cyan-100 text-cyan-800 border-cyan-200',
}

export function WeeklyGrid() {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [forecast, setForecast] = useState<LaborForecast | null>(null)
  const [loading, setLoading] = useState(true)
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
    return d.toISOString().split('T')[0]
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [shiftsRes, forecastRes] = await Promise.all([
        fetch(`/api/scheduling/shifts?week_start=${weekStart}`),
        fetch(`/api/scheduling/labor-forecast?week_start=${weekStart}`),
      ])
      const [shiftsJson, forecastJson] = await Promise.all([shiftsRes.json(), forecastRes.json()])
      setShifts(shiftsJson.data ?? [])
      setForecast(forecastJson.data ?? null)
    } catch {
      toast.error('Failed to load schedule')
    } finally {
      setLoading(false)
    }
  }, [weekStart])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const navigateWeek = (direction: number) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + direction * 7)
    setWeekStart(d.toISOString().split('T')[0])
  }

  const getWeekDates = () => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      return d
    })
  }

  const weekDates = getWeekDates()

  // Group shifts by staff
  const staffNames = Array.from(new Set(shifts.map((s) => s.staff_name))).sort()

  if (loading) {
    return <Skeleton className="h-96 rounded-xl" />
  }

  return (
    <div className="space-y-6">
      {/* Header with Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigateWeek(-1)} className="h-8 w-8 p-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="font-semibold">
            {weekDates[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} -{' '}
            {weekDates[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </h3>
          <Button variant="ghost" size="sm" onClick={() => navigateWeek(1)} className="h-8 w-8 p-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button size="sm">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Shift
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Schedule Grid */}
        <div className="lg:col-span-3">
          <Card className="border-warm shadow-warm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left text-xs font-medium text-gray-500 p-2 w-32">Staff</th>
                    {weekDates.map((date, i) => {
                      const isToday = date.toDateString() === new Date().toDateString()
                      return (
                        <th
                          key={i}
                          className={`text-center text-xs font-medium p-2 ${
                            isToday ? 'bg-orange-50 text-orange-700' : 'text-gray-500'
                          }`}
                        >
                          <div>{DAYS[i]}</div>
                          <div className="text-[10px]">{date.getDate()}</div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {staffNames.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-muted-foreground">
                        No shifts scheduled for this week
                      </td>
                    </tr>
                  ) : (
                    staffNames.map((staffName) => {
                      const staffShifts = shifts.filter((s) => s.staff_name === staffName)
                      return (
                        <tr key={staffName} className="border-b border-gray-100">
                          <td className="p-2">
                            <p className="text-xs font-medium truncate">{staffName}</p>
                            <p className="text-[10px] text-muted-foreground capitalize">
                              {staffShifts[0]?.role ?? ''}
                            </p>
                          </td>
                          {weekDates.map((date, i) => {
                            const dateStr = date.toISOString().split('T')[0]
                            const dayShifts = staffShifts.filter((s) => s.date === dateStr)
                            return (
                              <td key={i} className="p-1 align-top">
                                {dayShifts.map((shift) => {
                                  const colorClass = ROLE_COLORS[shift.role] ?? 'bg-gray-100 text-gray-700 border-gray-200'
                                  return (
                                    <div
                                      key={shift.id}
                                      className={`text-[10px] px-1.5 py-1 rounded border mb-0.5 cursor-pointer hover:opacity-80 ${colorClass}`}
                                    >
                                      <div className="font-medium">{shift.start_time}-{shift.end_time}</div>
                                    </div>
                                  )
                                })}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Labor Forecast Sidebar */}
        <div className="space-y-4">
          <Card className={`border-warm shadow-warm ${forecast?.is_over_target ? 'ring-2 ring-red-200' : ''}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Labor Forecast
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Hours</span>
                <span className="font-medium">{forecast?.total_hours ?? 0}h</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cost</span>
                <span className="font-medium">${((forecast?.total_cost ?? 0) / 100).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Projected Sales</span>
                <span className="font-medium">${((forecast?.projected_sales ?? 0) / 100).toLocaleString()}</span>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Labor %</span>
                  <span className={`font-bold ${
                    (forecast?.labor_pct ?? 0) > (forecast?.target_pct ?? 30)
                      ? 'text-red-600'
                      : 'text-green-600'
                  }`}>
                    {forecast?.labor_pct ?? 0}%
                  </span>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-muted-foreground">Target</span>
                  <span>{forecast?.target_pct ?? 30}%</span>
                </div>
                {/* Progress bar */}
                <div className="h-2 bg-gray-100 rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      (forecast?.labor_pct ?? 0) > (forecast?.target_pct ?? 30) ? 'bg-red-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, (forecast?.labor_pct ?? 0) * 100 / Math.max(1, (forecast?.target_pct ?? 30) * 1.5))}%` }}
                  />
                </div>
              </div>
              {forecast?.is_over_target && (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg p-2">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Over target by {((forecast?.labor_pct ?? 0) - (forecast?.target_pct ?? 30)).toFixed(1)}%
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

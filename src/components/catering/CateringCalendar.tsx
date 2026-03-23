'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Calendar, ChevronLeft, ChevronRight, Plus, DollarSign, Users, FileText, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface CateringEvent {
  id: string
  name: string
  event_date: string
  start_time: string
  guest_count: number
  contact_name: string
  status: 'inquiry' | 'proposal' | 'confirmed' | 'completed' | 'cancelled'
  total_amount: number
  deposit_amount: number
}

const STATUS_COLORS: Record<string, string> = {
  inquiry: 'bg-blue-50 text-blue-700 border-blue-200',
  proposal: 'bg-purple-50 text-purple-700 border-purple-200',
  confirmed: 'bg-green-50 text-green-700 border-green-200',
  completed: 'bg-gray-50 text-gray-600 border-gray-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
}

export function CateringCalendar() {
  const [events, setEvents] = useState<CateringEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const year = currentMonth.getFullYear()
      const month = currentMonth.getMonth() + 1
      const res = await fetch(`/api/catering/events?year=${year}&month=${month}`)
      const json = await res.json()
      if (res.ok) setEvents(json.data ?? [])
    } catch {
      toast.error('Failed to load events')
    } finally {
      setLoading(false)
    }
  }, [currentMonth])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()
  const firstDayOfWeek = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay()
  const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })

  const getEventsForDay = (day: number) => {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.filter((e) => e.event_date?.startsWith(dateStr))
  }

  // Pipeline summary
  const pipeline = {
    inquiry: events.filter((e) => e.status === 'inquiry').length,
    proposal: events.filter((e) => e.status === 'proposal').length,
    confirmed: events.filter((e) => e.status === 'confirmed').length,
    completed: events.filter((e) => e.status === 'completed').length,
  }
  const totalRevenue = events.filter((e) => e.status === 'confirmed' || e.status === 'completed').reduce((sum, e) => sum + (e.total_amount ?? 0), 0)

  if (loading) {
    return <Skeleton className="h-96 rounded-xl" />
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(pipeline).map(([status, count]) => (
          <Card key={status} className="border-warm shadow-warm">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground capitalize">{status}</p>
              <p className="text-xl font-bold">{count}</p>
            </CardContent>
          </Card>
        ))}
        <Card className="border-warm shadow-warm">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Revenue</p>
            <p className="text-xl font-bold text-green-600">${(totalRevenue / 100).toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Calendar */}
      <Card className="border-warm shadow-warm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {monthName}
            </CardTitle>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentMonth(new Date())}
                className="h-8 px-2 text-xs"
              >
                Today
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-px mb-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-lg overflow-hidden">
            {/* Empty cells for first week */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="bg-gray-50 min-h-[80px] p-1" />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dayEvents = getEventsForDay(day)
              const isToday =
                day === new Date().getDate() &&
                currentMonth.getMonth() === new Date().getMonth() &&
                currentMonth.getFullYear() === new Date().getFullYear()

              return (
                <div
                  key={day}
                  className={`bg-white min-h-[80px] p-1.5 ${isToday ? 'ring-2 ring-orange-400 ring-inset' : ''}`}
                >
                  <p className={`text-xs font-medium mb-1 ${isToday ? 'text-orange-600' : 'text-gray-500'}`}>
                    {day}
                  </p>
                  {dayEvents.slice(0, 2).map((event) => (
                    <div
                      key={event.id}
                      className={`text-[10px] px-1 py-0.5 rounded mb-0.5 truncate cursor-pointer ${
                        STATUS_COLORS[event.status]?.replace('border-', 'border border-') ?? 'bg-gray-50'
                      }`}
                      title={`${event.name} - ${event.contact_name} (${event.guest_count} guests)`}
                    >
                      {event.name}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <p className="text-[9px] text-muted-foreground">+{dayEvents.length - 2} more</p>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Events List */}
      <Card className="border-warm shadow-warm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Upcoming Events</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {events
            .filter((e) => e.status !== 'cancelled' && e.status !== 'completed')
            .sort((a, b) => a.event_date.localeCompare(b.event_date))
            .slice(0, 10)
            .map((event) => (
              <div key={event.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{event.name}</p>
                    <Badge variant="outline" className={STATUS_COLORS[event.status] ?? ''}>
                      {event.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{new Date(event.event_date).toLocaleDateString()}</span>
                    <span className="flex items-center gap-0.5"><Users className="h-3 w-3" /> {event.guest_count}</span>
                    <span>{event.contact_name}</span>
                  </div>
                </div>
                <div className="text-right ml-3">
                  <p className="font-medium text-sm">${((event.total_amount ?? 0) / 100).toLocaleString()}</p>
                  {event.deposit_amount > 0 && (
                    <p className="text-[10px] text-green-600">Deposit: ${((event.deposit_amount ?? 0) / 100).toFixed(0)}</p>
                  )}
                </div>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  )
}

'use client'

import { useState, useCallback } from 'react'
import { KdsTimer } from './KdsTimer'

interface TicketItem {
  id: string
  name: string
  quantity: number
  modifiers: string[]
  special_instructions: string
  seat_number: number | null
  course: number
  status: 'pending' | 'in_progress' | 'completed'
  is_void?: boolean
}

interface KdsTicketData {
  id: string
  order_id: string
  order_number: string
  order_type: string
  server_name: string
  table_name: string | null
  items: TicketItem[]
  created_at: string
  age_seconds: number
  age_category: 'fresh' | 'aging' | 'late' | 'critical'
  is_rush: boolean
  station_id: string
}

interface KdsTicketProps {
  ticket: KdsTicketData
  onBump: (ticketId: string) => void
}

const ORDER_TYPE_LABELS: Record<string, string> = {
  dine_in: 'Dine-In',
  takeout: 'Takeout',
  delivery: 'Delivery',
  bar: 'Bar',
  catering: 'Catering',
  online: 'Online',
  kiosk: 'Kiosk',
  drive_thru: 'Drive-Thru',
  qr: 'QR',
}

const ORDER_TYPE_COLORS: Record<string, string> = {
  dine_in: 'bg-blue-600',
  takeout: 'bg-green-600',
  delivery: 'bg-purple-600',
  bar: 'bg-amber-600',
  catering: 'bg-cyan-600',
  online: 'bg-indigo-600',
  kiosk: 'bg-pink-600',
  drive_thru: 'bg-rose-600',
  qr: 'bg-teal-600',
}

function getAgingBackground(category: 'fresh' | 'aging' | 'late' | 'critical'): string {
  switch (category) {
    case 'fresh':
      return 'bg-[var(--card)]'
    case 'aging':
      return 'bg-yellow-900/30 border-yellow-500/40'
    case 'late':
      return 'bg-orange-900/30 border-orange-500/40'
    case 'critical':
      return 'bg-red-900/40 border-red-500/50 animate-pulse-attention'
    default:
      return 'bg-[var(--card)]'
  }
}

export function KdsTicket({ ticket, onBump }: KdsTicketProps) {
  const [isSliding, setIsSliding] = useState(false)

  const handleBump = useCallback(() => {
    setIsSliding(true)
    // Wait for animation before calling onBump
    setTimeout(() => {
      onBump(ticket.id)
    }, 250)
  }, [ticket.id, onBump])

  // Group items by course
  const courseGroups = new Map<number, TicketItem[]>()
  for (const item of ticket.items) {
    const course = item.course
    const group = courseGroups.get(course) ?? []
    group.push(item)
    courseGroups.set(course, group)
  }

  const courses = [...courseGroups.entries()].sort(([a], [b]) => a - b)
  const hasMultipleCourses = courses.length > 1

  return (
    <div
      className={`flex flex-col rounded-lg border transition-all duration-250 ${getAgingBackground(
        ticket.age_category
      )} ${isSliding ? 'animate-slide-out-left' : 'animate-slide-in-right'} ${
        ticket.is_rush ? 'ring-2 ring-red-500' : ''
      }`}
      style={{ minWidth: 0 }}
    >
      {/* Rush banner */}
      {ticket.is_rush && (
        <div className="flex items-center justify-center rounded-t-lg bg-red-600 px-3 py-1.5 text-sm font-black tracking-wider text-white">
          RUSH
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-[var(--border)] p-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-[var(--foreground)]">
              #{ticket.order_number}
            </span>
            <span
              className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold text-white ${
                ORDER_TYPE_COLORS[ticket.order_type] ?? 'bg-gray-600'
              }`}
            >
              {ORDER_TYPE_LABELS[ticket.order_type] ?? ticket.order_type}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <span>{ticket.server_name}</span>
            {ticket.table_name && (
              <>
                <span className="text-[var(--border)]">&middot;</span>
                <span className="font-medium text-[var(--foreground)]">{ticket.table_name}</span>
              </>
            )}
          </div>
        </div>
        <KdsTimer createdAt={ticket.created_at} />
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-3">
        {courses.map(([course, items], idx) => (
          <div key={course}>
            {hasMultipleCourses && (
              <div className="mb-1.5 mt-1 flex items-center gap-2">
                <div className="h-px flex-1 bg-[var(--border)]" />
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
                  Course {course}
                </span>
                <div className="h-px flex-1 bg-[var(--border)]" />
              </div>
            )}
            {idx > 0 && !hasMultipleCourses && (
              <div className="my-1 h-px bg-[var(--border)]" />
            )}
            {items.map((item) => (
              <div
                key={item.id}
                className={`mb-1.5 ${item.is_void ? 'opacity-40' : ''}`}
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-[var(--secondary)] text-sm font-bold text-[var(--foreground)]">
                    {item.quantity}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span
                      className={`text-base font-semibold text-[var(--foreground)] ${
                        item.is_void ? 'line-through' : ''
                      }`}
                    >
                      {item.name}
                      {item.is_void && (
                        <span className="ml-2 text-xs font-bold text-red-400">(VOIDED)</span>
                      )}
                    </span>
                    {item.modifiers.length > 0 && (
                      <div className="mt-0.5">
                        {item.modifiers.map((mod, i) => (
                          <div
                            key={i}
                            className="pl-2 text-sm text-[var(--muted-foreground)]"
                          >
                            &bull; {mod}
                          </div>
                        ))}
                      </div>
                    )}
                    {item.special_instructions && (
                      <div className="mt-0.5 rounded bg-yellow-900/30 px-2 py-0.5 text-sm italic text-yellow-300">
                        {item.special_instructions}
                      </div>
                    )}
                  </div>
                  {item.seat_number != null && (
                    <span className="mt-0.5 flex-shrink-0 text-xs text-[var(--muted-foreground)]">
                      S{item.seat_number}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Bump button */}
      <button
        onClick={handleBump}
        className="btn-press touch-target-lg m-2 flex h-14 items-center justify-center rounded-lg bg-green-600 text-lg font-black uppercase tracking-wider text-white transition-colors hover:bg-green-500 active:bg-green-700"
      >
        BUMP
      </button>
    </div>
  )
}

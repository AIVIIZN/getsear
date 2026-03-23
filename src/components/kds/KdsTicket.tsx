'use client'

import { useState, useCallback } from 'react'
import { KdsTimer } from './KdsTimer'
import { cn } from '@/lib/utils'

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
  is_fired?: boolean
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
  is_add?: boolean
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

// Aging colors per POS_UI_RESEARCH.md — vivid on dark background
function getAgingStyles(category: 'fresh' | 'aging' | 'late' | 'critical') {
  switch (category) {
    case 'fresh':
      return {
        card: 'bg-[var(--card)] border-[var(--border)]',
        headerColor: '#34C759', // iOS green
      }
    case 'aging':
      return {
        card: 'bg-[#1a1a00] border-[#FFCC00]/40',
        headerColor: '#FFCC00', // iOS yellow
      }
    case 'late':
      return {
        card: 'bg-[#1a0d00] border-[#FF9500]/40',
        headerColor: '#FF9500', // iOS orange
      }
    case 'critical':
      return {
        card: 'bg-[#1a0000] border-[#FF3B30]/50 animate-kds-flash',
        headerColor: '#FF3B30', // iOS red
      }
    default:
      return {
        card: 'bg-[var(--card)] border-[var(--border)]',
        headerColor: '#34C759',
      }
  }
}

export function KdsTicket({ ticket, onBump }: KdsTicketProps) {
  const [isSliding, setIsSliding] = useState(false)

  const handleBump = useCallback(() => {
    setIsSliding(true)
    setTimeout(() => {
      onBump(ticket.id)
    }, 280)
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

  function isCourseHeld(courseItems: TicketItem[]): boolean {
    return courseItems.every((item) => !item.is_fired && item.status === 'pending')
  }

  const aging = getAgingStyles(ticket.age_category)

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border transition-all',
        aging.card,
        isSliding ? 'animate-slide-out-right' : 'animate-slide-in-left',
        ticket.is_rush && 'ring-2 ring-red-500'
      )}
      style={{ minWidth: 0, transitionDuration: 'var(--duration-slow)' }}
    >
      {/* Rush banner */}
      {ticket.is_rush && (
        <div className="flex items-center justify-center rounded-t-xl bg-red-600 px-3 py-2 text-subhead font-black tracking-wider text-white animate-pulse-attention">
          RUSH
        </div>
      )}

      {/* ADD badge */}
      {ticket.is_add && (
        <div className="flex items-center justify-center bg-blue-600 px-3 py-1.5 text-footnote font-black tracking-wider text-white">
          ADD
        </div>
      )}

      {/* Header — with aging color accent */}
      <div
        className="flex items-start justify-between gap-2 p-3"
        style={{ borderBottom: `2px solid ${aging.headerColor}` }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-title-2 font-black text-[var(--foreground)]">
              #{ticket.order_number}
            </span>
            <span
              className={cn(
                'inline-flex items-center rounded-lg px-2 py-0.5 text-caption-1 font-bold text-white',
                ORDER_TYPE_COLORS[ticket.order_type] ?? 'bg-gray-600'
              )}
            >
              {ORDER_TYPE_LABELS[ticket.order_type] ?? ticket.order_type}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-subhead text-[var(--muted-foreground)]">
            <span>{ticket.server_name}</span>
            {ticket.table_name && (
              <>
                <span className="opacity-40">&middot;</span>
                <span className="font-semibold text-[var(--foreground)]">{ticket.table_name}</span>
              </>
            )}
          </div>
        </div>
        <KdsTimer createdAt={ticket.created_at} />
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto scroll-container scrollbar-hide p-3">
        {courses.map(([course, items], idx) => {
          const held = hasMultipleCourses && course > 1 && isCourseHeld(items)
          return (
            <div key={course}>
              {hasMultipleCourses && (
                <div className="mb-2 mt-1.5 flex items-center gap-2">
                  <div className="h-px flex-1 bg-[var(--border)]" />
                  <span className="text-caption-1 font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                    Course {course}
                  </span>
                  {held && (
                    <span className="rounded-md bg-gray-600 px-2 py-0.5 text-caption-2 font-black uppercase text-gray-200">
                      HOLD
                    </span>
                  )}
                  <div className="h-px flex-1 bg-[var(--border)]" />
                </div>
              )}
              {idx > 0 && !hasMultipleCourses && (
                <div className="my-1.5 h-px bg-[var(--border)]" />
              )}
              <div className={held ? 'opacity-40' : ''}>
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={cn('mb-2', item.is_void && 'opacity-40')}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--secondary)] text-subhead font-bold text-[var(--foreground)]">
                        {item.quantity}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span
                          className={cn(
                            'text-callout font-semibold text-[var(--foreground)]',
                            item.is_void && 'line-through'
                          )}
                        >
                          {item.name}
                          {item.is_void && (
                            <span className="ml-2 text-caption-1 font-bold text-red-400">(VOIDED)</span>
                          )}
                          {item.status === 'completed' && (
                            <span className="ml-2 text-caption-1 font-bold text-green-400">&#10003;</span>
                          )}
                        </span>
                        {item.modifiers.length > 0 && (
                          <div className="mt-0.5">
                            {item.modifiers.map((mod, i) => (
                              <div
                                key={i}
                                className="pl-2 text-subhead text-[var(--muted-foreground)]"
                              >
                                &bull; {mod}
                              </div>
                            ))}
                          </div>
                        )}
                        {item.special_instructions && (
                          <div className="mt-1 rounded-lg bg-yellow-900/30 px-2.5 py-1 text-subhead italic text-yellow-300">
                            {item.special_instructions}
                          </div>
                        )}
                      </div>
                      {item.seat_number != null && (
                        <span className="mt-0.5 flex-shrink-0 text-caption-1 font-medium text-[var(--muted-foreground)]">
                          S{item.seat_number}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Bump button — 56px tall, green, full width */}
      <button
        onClick={handleBump}
        className="btn-press m-3 flex items-center justify-center rounded-xl bg-[#34C759] text-headline font-black uppercase tracking-wider text-white transition-colors hover:bg-[#30D158] active:bg-[#28a745]"
        style={{ height: 56 }}
      >
        BUMP
      </button>
    </div>
  )
}

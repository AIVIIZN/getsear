'use client'

import { useState, useCallback, useRef } from 'react'
import { KdsTimer } from './KdsTimer'
import { KdsAllergenBanner } from './KdsAllergenBanner'
import { KdsPriorityBanner } from './KdsPriorityBanner'
import { KdsRefireDialog } from './KdsRefireDialog'
import { cn } from '@/lib/utils'
import { type KdsTicket as KdsTicketData, type KdsTicketItem, type RefireReasonCode, type ItemStatus } from '@/stores/kds-store'

interface KdsTicketProps {
  ticket: KdsTicketData
  onBump: (ticketId: string) => void
  onItemBump?: (ticketId: string, itemId: string) => void
  onRefire?: (ticketId: string, itemId: string, reason: RefireReasonCode) => void
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

// Aging colors per POS_UI_RESEARCH.md -- vivid on dark background
function getAgingStyles(category: 'fresh' | 'aging' | 'late' | 'critical') {
  switch (category) {
    case 'fresh':
      return {
        card: 'bg-[#1a1a1a] border-[#2a2a2a]',
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
        card: 'bg-[#1a1a1a] border-[#2a2a2a]',
        headerColor: '#34C759',
      }
  }
}

function getItemAgingColor(ageCategory: string | undefined): string {
  switch (ageCategory) {
    case 'aging': return 'border-l-[#FFCC00]'
    case 'late': return 'border-l-[#FF9500]'
    case 'critical': return 'border-l-[#FF3B30]'
    default: return 'border-l-transparent'
  }
}

export function KdsTicket({ ticket, onBump, onItemBump, onRefire }: KdsTicketProps) {
  const [isSliding, setIsSliding] = useState(false)
  const [refireItem, setRefireItem] = useState<KdsTicketItem | null>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleBump = useCallback(() => {
    setIsSliding(true)
    setTimeout(() => {
      onBump(ticket.id)
    }, 280)
  }, [ticket.id, onBump])

  const handleItemBump = useCallback(
    (itemId: string) => {
      onItemBump?.(ticket.id, itemId)
    },
    [ticket.id, onItemBump]
  )

  const handleRefireSelect = useCallback(
    (reason: RefireReasonCode) => {
      if (refireItem) {
        onRefire?.(ticket.id, refireItem.id, reason)
      }
      setRefireItem(null)
    },
    [ticket.id, refireItem, onRefire]
  )

  // Long-press handlers for re-fire
  const handleItemLongPressStart = useCallback(
    (item: KdsTicketItem) => {
      if (!item.is_bumped && item.status !== 'completed') return
      if (item.is_void) return

      longPressTimerRef.current = setTimeout(() => {
        setRefireItem(item)
      }, 600) // 600ms long press
    },
    []
  )

  const handleItemLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  // Group items by course
  const courseGroups = new Map<number, KdsTicketItem[]>()
  for (const item of ticket.items) {
    const course = item.course
    const group = courseGroups.get(course) ?? []
    group.push(item)
    courseGroups.set(course, group)
  }

  const courses = [...courseGroups.entries()].sort(([a], [b]) => a - b)
  const hasMultipleCourses = courses.length > 1

  function isCourseHeld(courseItems: KdsTicketItem[]): boolean {
    return courseItems.every((item) => !item.is_fired && item.status === 'pending')
  }

  // Check if all bumpable items are bumped (for auto-bump)
  const allItemsBumped = ticket.items
    .filter((item) => !item.is_void && item.status !== 'held')
    .every((item) => item.is_bumped || item.status === 'completed')

  // Determine aging -- allergen tickets always have red border
  const aging = ticket.has_allergens
    ? { card: 'bg-[#1a0000] border-[#FF0000]', headerColor: '#FF0000' }
    : getAgingStyles(ticket.age_category)

  // Priority-based border effects
  const priorityBorderClass =
    ticket.priority === 'refire'
      ? 'ring-2 ring-[#FF2D55] animate-pulse-attention'
      : ticket.priority === 'rush'
        ? 'ring-2 ring-red-500'
        : ticket.priority === 'vip'
          ? 'ring-2 ring-[#FFD700]'
          : ''

  return (
    <>
      <div
        className={cn(
          'flex flex-col rounded-xl border transition-all',
          aging.card,
          priorityBorderClass,
          isSliding ? 'animate-slide-out-right' : 'animate-slide-in-left'
        )}
        style={{ minWidth: 0, transitionDuration: 'var(--duration-slow)' }}
      >
        {/* Priority banner (RE-FIRE / RUSH / VIP) */}
        <KdsPriorityBanner
          priority={ticket.priority}
          refireReason={ticket.items.find((i) => i.is_refire)?.refire_reason}
          refireCount={ticket.items.find((i) => i.is_refire)?.refire_count}
        />

        {/* Allergen banner -- CANNOT be dismissed */}
        {ticket.has_allergens && ticket.allergens && (
          <KdsAllergenBanner allergens={ticket.allergens} />
        )}

        {/* ADD badge */}
        {ticket.is_add && (
          <div className="flex items-center justify-center bg-blue-600 px-3 py-1.5 text-footnote font-black tracking-wider text-white">
            ADD
          </div>
        )}

        {/* Header -- with aging color accent */}
        <div
          className="flex items-start justify-between gap-2 p-3"
          style={{ borderBottom: `2px solid ${aging.headerColor}` }}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-title-2 font-black text-white">
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
            <div className="mt-1 flex items-center gap-2 text-subhead text-[#888]">
              <span>{ticket.server_name}</span>
              {ticket.table_name && (
                <>
                  <span className="opacity-40">&middot;</span>
                  <span className="font-semibold text-white">{ticket.table_name}</span>
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
                    <div className="h-px flex-1 bg-[#333]" />
                    <span className="text-caption-1 font-bold uppercase tracking-wider text-[#888]">
                      Course {course}
                    </span>
                    {held && (
                      <span className="rounded-md bg-gray-600 px-2 py-0.5 text-caption-2 font-black uppercase text-gray-200">
                        HOLD
                      </span>
                    )}
                    <div className="h-px flex-1 bg-[#333]" />
                  </div>
                )}
                {idx > 0 && !hasMultipleCourses && (
                  <div className="my-1.5 h-px bg-[#333]" />
                )}
                <div className={held ? 'opacity-40' : ''}>
                  {items.map((item) => (
                    <TicketItemRow
                      key={item.id}
                      item={item}
                      held={held}
                      onBump={handleItemBump}
                      onLongPressStart={handleItemLongPressStart}
                      onLongPressEnd={handleItemLongPressEnd}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Bump button -- 56px tall, green, full width */}
        <button
          onClick={allItemsBumped ? handleBump : handleBump}
          className={cn(
            'btn-press m-3 flex items-center justify-center rounded-xl text-headline font-black uppercase tracking-wider text-white transition-colors',
            allItemsBumped
              ? 'bg-[#34C759] hover:bg-[#30D158] active:bg-[#28a745]'
              : 'bg-[#34C759] hover:bg-[#30D158] active:bg-[#28a745]'
          )}
          style={{ height: 56, minHeight: 56 }}
        >
          BUMP
        </button>
      </div>

      {/* Re-fire dialog */}
      <KdsRefireDialog
        itemName={refireItem?.name ?? ''}
        isOpen={refireItem !== null}
        onSelect={handleRefireSelect}
        onClose={() => setRefireItem(null)}
      />
    </>
  )
}

/** Individual item row with bump button and status indicators */
function TicketItemRow({
  item,
  held,
  onBump,
  onLongPressStart,
  onLongPressEnd,
}: {
  item: KdsTicketItem
  held: boolean
  onBump: (itemId: string) => void
  onLongPressStart: (item: KdsTicketItem) => void
  onLongPressEnd: () => void
}) {
  const isBumped = item.is_bumped || item.status === 'completed'
  const isVoided = item.is_void
  const isHeld = held || item.status === 'held'
  const isRefire = item.is_refire

  const itemStatus: ItemStatus = isVoided
    ? 'voided'
    : isHeld
      ? 'held'
      : isBumped
        ? 'completed'
        : item.status === 'in_progress'
          ? 'in_progress'
          : 'pending'

  return (
    <div
      className={cn(
        'mb-2 flex items-start gap-2.5 rounded-lg border-l-2 pl-1',
        isVoided && 'opacity-40',
        isBumped && !isVoided && 'opacity-50',
        getItemAgingColor(item.item_age_category)
      )}
      onTouchStart={() => onLongPressStart(item)}
      onTouchEnd={onLongPressEnd}
      onTouchCancel={onLongPressEnd}
      onMouseDown={() => onLongPressStart(item)}
      onMouseUp={onLongPressEnd}
      onMouseLeave={onLongPressEnd}
    >
      {/* Quantity badge */}
      <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[#2a2a2a] text-subhead font-bold text-white">
        {item.quantity}
      </span>

      {/* Item info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'text-callout font-semibold text-white',
              isVoided && 'line-through',
              isBumped && 'text-[#888]'
            )}
          >
            {item.name}
          </span>
          {isRefire && (
            <span className="rounded bg-[#FF2D55] px-1.5 py-0.5 text-caption-2 font-black text-white">
              RE-FIRE{(item.refire_count ?? 0) > 1 ? ` x${item.refire_count}` : ''}
            </span>
          )}
          {item.is_add && !isRefire && (
            <span className="rounded bg-blue-600 px-1.5 py-0.5 text-caption-2 font-black uppercase tracking-wider text-white">
              ADD
            </span>
          )}
          {isVoided && (
            <span className="text-caption-1 font-bold text-red-400">(VOIDED)</span>
          )}
          {isHeld && !held && (
            <span className="rounded-md bg-gray-600 px-1.5 py-0.5 text-caption-2 font-black uppercase text-gray-200">
              HOLD
            </span>
          )}
        </div>
        {item.modifiers.length > 0 && (
          <div className="mt-0.5">
            {item.modifiers.map((mod, i) => (
              <div
                key={i}
                className={cn(
                  'pl-2 text-subhead text-[#888]',
                  isBumped && 'text-[#555]'
                )}
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
        {isRefire && item.refire_reason && (
          <div className="mt-1 rounded-lg bg-[#FF2D55]/20 px-2.5 py-1 text-caption-1 font-semibold text-[#FF2D55]">
            Reason: {item.refire_reason.replace(/_/g, ' ')}
          </div>
        )}
      </div>

      {/* Seat number */}
      {item.seat_number != null && (
        <span className="mt-0.5 flex-shrink-0 text-caption-1 font-medium text-[#888]">
          S{item.seat_number}
        </span>
      )}

      {/* Bump button / status indicator */}
      <div className="flex-shrink-0">
        {isVoided ? (
          <div className="flex h-11 w-11 items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-red-400">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </div>
        ) : isHeld ? (
          <div className="flex h-11 w-11 items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-gray-500">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          </div>
        ) : isBumped ? (
          <div className="flex h-11 w-11 items-center justify-center animate-fade-in">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-[#34C759]">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onBump(item.id)
            }}
            className="btn-press flex h-11 w-11 items-center justify-center rounded-lg bg-[#2a2a2a] transition-colors hover:bg-[#3a3a3a] active:bg-[#34C759]"
            style={{ minWidth: 44, minHeight: 44 }}
            aria-label={`Bump ${item.name}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-[#888]">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

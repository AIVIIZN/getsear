'use client'

import { useState, useCallback, useRef } from 'react'
import { KdsTimer } from './KdsTimer'
import { KdsAllergenBanner } from './KdsAllergenBanner'
import { KdsPriorityBanner } from './KdsPriorityBanner'
import { KdsRefireDialog } from './KdsRefireDialog'
import { Badge } from '@/components/ui-v2/data/Badge'
import { cn } from '@/lib/utils'
import {
  getAgingBackground,
  getItemAgingBorder,
  getTicketAgingColor,
} from './aging'
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

export function KdsTicket({ ticket, onBump, onItemBump, onRefire }: KdsTicketProps) {
  const [isSliding, setIsSliding] = useState(false)
  const [refireItem, setRefireItem] = useState<KdsTicketItem | null>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleBump = useCallback(() => {
    setIsSliding(true)
    // Match kds-bump-spring keyframe (320ms) — see src/styles/tokens.css
    setTimeout(() => {
      onBump(ticket.id)
    }, 320)
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

  // Aging gradient: server-supplied category drives a CSS custom property the
  // card consumes for its border + header underline. Allergen forces critical.
  const ageCategory = ticket.has_allergens ? 'critical' : ticket.age_category
  const ticketAgeColor = getTicketAgingColor(ageCategory)
  const ticketBg = getAgingBackground(ageCategory)
  const flashClass = ageCategory === 'critical' ? 'animate-kds-flash' : ''

  // Priority-based border effects
  const priorityBorderClass =
    ticket.priority === 'refire'
      ? 'ring-2 ring-[var(--color-kds-priority-refire)] animate-pulse-attention'
      : ticket.priority === 'rush'
        ? 'ring-2 ring-red-500'
        : ticket.priority === 'vip'
          ? 'ring-2 ring-[var(--color-kds-priority-vip)]'
          : ''

  return (
    <>
      <div
        className={cn(
          'flex flex-col rounded-[var(--radius-md)] border transition-all kds-aging-border',
          flashClass,
          priorityBorderClass,
          isSliding ? 'kds-bump-out' : 'animate-slide-in-left'
        )}
        style={{
          minWidth: 0,
          transitionDuration: 'var(--duration-base)',
          backgroundColor: ticketBg,
          // Per-ticket aging color drives both border + header underline.
          ['--ticket-age-color' as string]: ticketAgeColor,
        }}
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
          <div
            className="flex items-center justify-center px-3 py-1.5 text-footnote font-black tracking-wider text-[var(--color-primary-fg)]"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            ADD
          </div>
        )}

        {/* Header -- with aging color accent */}
        <div
          className="flex items-start justify-between gap-2 p-3"
          style={{ borderBottom: '2px solid var(--ticket-age-color)' }}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-title-2 font-black text-[var(--color-text)]">
                #{ticket.order_number}
              </span>
              <span
                className={cn(
                  'inline-flex items-center rounded-[var(--radius-sm)] px-2 py-0.5 text-caption-1 font-bold text-white',
                  ORDER_TYPE_COLORS[ticket.order_type] ?? 'bg-gray-600'
                )}
              >
                {ORDER_TYPE_LABELS[ticket.order_type] ?? ticket.order_type}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-subhead text-[var(--color-text-muted)]">
              <span>{ticket.server_name}</span>
              {ticket.table_name && (
                <>
                  <span className="opacity-40">&middot;</span>
                  <span className="font-semibold text-[var(--color-text)]">{ticket.table_name}</span>
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
                    <div className="h-px flex-1 bg-[var(--color-border)]" />
                    <span className="text-caption-1 font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                      Course {course}
                    </span>
                    {held && (
                      <Badge variant="default" size="sm" className="font-[number:var(--weight-bold)] uppercase">
                        HOLD
                      </Badge>
                    )}
                    <div className="h-px flex-1 bg-[var(--color-border)]" />
                  </div>
                )}
                {idx > 0 && !hasMultipleCourses && (
                  <div className="my-1.5 h-px bg-[var(--color-border)]" />
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

        {/* Bump button -- 56px tall, green, full width.
            Uses raw <button> with token colors instead of ui-v2 Button so the
            full-width 56pt + iOS green stays a kitchen-staff signature shape. */}
        <button
          type="button"
          onClick={handleBump}
          className={cn(
            'btn-press m-3 flex items-center justify-center rounded-[var(--radius-md)] text-headline font-black uppercase tracking-wider text-white transition-colors',
            'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-border-focus)]',
            'touch-target',
          )}
          style={{
            height: 56,
            minHeight: 56,
            backgroundColor: 'var(--color-success-strong)',
          }}
          aria-label="Bump ticket"
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
        'mb-2 flex items-start gap-2.5 rounded-[var(--radius-sm)] border-l-2 pl-1',
        isVoided && 'opacity-40',
        isBumped && !isVoided && 'opacity-50',
      )}
      style={{ borderLeftColor: getItemAgingBorder(item.item_age_category) }}
      onTouchStart={() => onLongPressStart(item)}
      onTouchEnd={onLongPressEnd}
      onTouchCancel={onLongPressEnd}
      onMouseDown={() => onLongPressStart(item)}
      onMouseUp={onLongPressEnd}
      onMouseLeave={onLongPressEnd}
    >
      {/* Quantity badge */}
      <span
        className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-subhead font-bold text-[var(--color-text)]"
        style={{ backgroundColor: 'var(--color-bg-muted)' }}
      >
        {item.quantity}
      </span>

      {/* Item info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'text-callout font-semibold text-[var(--color-text)]',
              isVoided && 'line-through',
              isBumped && 'text-[var(--color-text-muted)]'
            )}
          >
            {item.name}
          </span>
          {isRefire && (
            <Badge
              size="sm"
              className="font-[number:var(--weight-bold)] !text-white"
              style={{ backgroundColor: 'var(--color-kds-priority-refire)' }}
            >
              RE-FIRE{(item.refire_count ?? 0) > 1 ? ` x${item.refire_count}` : ''}
            </Badge>
          )}
          {item.is_add && !isRefire && (
            <Badge
              variant="primary"
              size="sm"
              className="uppercase font-[number:var(--weight-bold)]"
            >
              ADD
            </Badge>
          )}
          {isVoided && (
            <span className="text-caption-1 font-bold" style={{ color: 'var(--color-danger-strong)' }}>
              (VOIDED)
            </span>
          )}
          {isHeld && !held && (
            <Badge variant="default" size="sm" className="uppercase font-[number:var(--weight-bold)]">
              HOLD
            </Badge>
          )}
        </div>
        {item.modifiers.length > 0 && (
          <div className="mt-0.5">
            {item.modifiers.map((mod, i) => (
              <div
                key={i}
                className={cn(
                  'pl-2 text-subhead',
                  isBumped ? 'text-[var(--color-text-subtle)]' : 'text-[var(--color-text-muted)]',
                )}
              >
                &bull; {mod}
              </div>
            ))}
          </div>
        )}
        {item.special_instructions && (
          <div
            className="mt-1 rounded-[var(--radius-sm)] px-2.5 py-1 text-subhead italic"
            style={{
              backgroundColor: 'var(--color-warning-bg)',
              color: 'var(--color-warning-strong)',
            }}
          >
            {item.special_instructions}
          </div>
        )}
        {isRefire && item.refire_reason && (
          <div
            className="mt-1 rounded-[var(--radius-sm)] px-2.5 py-1 text-caption-1 font-semibold"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-kds-priority-refire) 20%, transparent)',
              color: 'var(--color-kds-priority-refire)',
            }}
          >
            Reason: {item.refire_reason.replace(/_/g, ' ')}
          </div>
        )}
      </div>

      {/* Seat number */}
      {item.seat_number != null && (
        <span className="mt-0.5 flex-shrink-0 text-caption-1 font-medium text-[var(--color-text-muted)]">
          S{item.seat_number}
        </span>
      )}

      {/* Bump button / status indicator -- 44pt min target */}
      <div className="flex-shrink-0">
        {isVoided ? (
          <div className="flex h-11 w-11 items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" style={{ color: 'var(--color-danger-strong)' }}>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </div>
        ) : isHeld ? (
          <div className="flex h-11 w-11 items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" style={{ color: 'var(--color-text-subtle)' }}>
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          </div>
        ) : isBumped ? (
          <div className="flex h-11 w-11 items-center justify-center animate-fade-in">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" style={{ color: 'var(--color-success-strong)' }}>
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onBump(item.id)
            }}
            className="btn-press touch-target flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-border-focus)]"
            style={{ backgroundColor: 'var(--color-bg-muted)' }}
            aria-label={`Bump ${item.name}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" style={{ color: 'var(--color-text-muted)' }}>
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

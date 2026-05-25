'use client'

import { useState, useCallback, useRef } from 'react'
import { KdsTimer } from './KdsTimer'
import { KdsAllergenBanner } from './KdsAllergenBanner'
import { KdsPriorityBanner } from './KdsPriorityBanner'
import { KdsRefireDialog } from './KdsRefireDialog'
import { Badge } from '@/components/ui-v2/data/Badge'
import { cn } from '@/lib/utils'
import { getAgingBackground, getTicketAgingColor } from './aging'
import { type KdsTicket as KdsTicketData, type KdsTicketItem, type RefireReasonCode } from '@/stores/kds-store'

/**
 * KDS Expo Ticket
 *
 * Enhanced ticket for expo view showing multi-station status.
 * - Station badges per item with completion indicators
 * - "READY TO RUN" animation state when all items complete
 * - Larger bump button for final expo bump
 * - Station origin labels on each item (e.g., "GRILL", "FRY", "COLD")
 * - Fire course button
 */

interface KdsExpoTicketProps {
  ticket: KdsTicketData
  onExpoBump: (ticketId: string) => void
  onRefire?: (ticketId: string, itemId: string, reason: RefireReasonCode) => void
  onFireCourse?: (ticketId: string, orderId: string, course: number) => void
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

// Station label colors for visual distinction
const STATION_COLORS: Record<string, string> = {
  grill: 'bg-red-700',
  fry: 'bg-amber-700',
  cold: 'bg-blue-700',
  saute: 'bg-orange-700',
  pastry: 'bg-pink-700',
  bar: 'bg-purple-700',
  expo: 'bg-green-700',
}

function getStationColor(station: string): string {
  const lower = station.toLowerCase()
  return STATION_COLORS[lower] ?? 'bg-gray-600'
}

export function KdsExpoTicket({ ticket, onExpoBump, onRefire, onFireCourse }: KdsExpoTicketProps) {
  const [isSliding, setIsSliding] = useState(false)
  const [refireItem, setRefireItem] = useState<KdsTicketItem | null>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Determine if all items are bumped (ready to run)
  const bumpableItems = ticket.items.filter((item) => !item.is_void)
  const allItemsBumped = bumpableItems.every(
    (item) => item.is_bumped || item.status === 'completed'
  )
  const isReadyToRun = ticket.is_ready_to_run || allItemsBumped

  // Pending stations for tooltip
  const pendingStations = new Set<string>()
  for (const item of bumpableItems) {
    if (!item.is_bumped && item.status !== 'completed') {
      pendingStations.add(item.station_label ?? item.prep_station ?? 'Unknown')
    }
  }

  const handleExpoBump = useCallback(() => {
    if (!isReadyToRun) return
    setIsSliding(true)
    // Match kds-bump-spring keyframe (320ms).
    setTimeout(() => {
      onExpoBump(ticket.id)
    }, 320)
  }, [ticket.id, onExpoBump, isReadyToRun])

  const handleRefireSelect = useCallback(
    (reason: RefireReasonCode) => {
      if (refireItem) {
        onRefire?.(ticket.id, refireItem.id, reason)
      }
      setRefireItem(null)
    },
    [ticket.id, refireItem, onRefire]
  )

  const handleItemLongPressStart = useCallback((item: KdsTicketItem) => {
    if (!item.is_bumped && item.status !== 'completed') return
    if (item.is_void) return

    longPressTimerRef.current = setTimeout(() => {
      setRefireItem(item)
    }, 600)
  }, [])

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

  // Aging gradient: server-supplied category drives the --ticket-age-color
  // CSS custom property for the card border and header underline. Allergen
  // and ready-to-run override the bucket; priority refire layers a ring.
  const ageCategory = ticket.has_allergens
    ? 'critical'
    : isReadyToRun
      ? 'fresh'
      : ticket.age_category
  const ticketAgeColor = isReadyToRun
    ? 'var(--color-kds-aging-fresh)'
    : getTicketAgingColor(ageCategory)
  const ticketBg = isReadyToRun
    ? 'color-mix(in srgb, var(--color-kds-aging-fresh) 12%, var(--color-kds-bg))'
    : getAgingBackground(ageCategory)
  const flashClass =
    !isReadyToRun && ageCategory === 'critical' ? 'animate-kds-flash' : ''
  const refireRing =
    !isReadyToRun && ticket.priority === 'refire'
      ? 'ring-2 ring-[var(--color-kds-priority-refire)] animate-pulse-attention'
      : ''
  const readyToRunGlow = isReadyToRun
    ? { boxShadow: '0 0 20px color-mix(in srgb, var(--color-kds-aging-fresh) 30%, transparent)' }
    : {}

  // Station completion summary
  const stationStatuses = ticket.station_statuses ?? {}

  return (
    <>
      <div
        className={cn(
          'flex flex-col rounded-[var(--radius-md)] border transition-all kds-aging-border',
          flashClass,
          refireRing,
          isSliding ? 'kds-bump-out' : 'animate-slide-in-left'
        )}
        style={{
          minWidth: 0,
          transitionDuration: 'var(--duration-base)',
          backgroundColor: ticketBg,
          ['--ticket-age-color' as string]: ticketAgeColor,
          ...readyToRunGlow,
        }}
      >
        {/* Ready to Run banner */}
        {isReadyToRun && (
          <div
            className="flex items-center justify-center gap-2 rounded-t-[var(--radius-md)] px-3 py-2.5 animate-pulse"
            style={{ backgroundColor: 'var(--color-success-strong)' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-white">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <span className="text-subhead font-black uppercase tracking-wider text-white">
              READY TO RUN
            </span>
          </div>
        )}

        {/* Priority banner */}
        {!isReadyToRun && (
          <KdsPriorityBanner
            priority={ticket.priority}
            refireReason={ticket.items.find((i) => i.is_refire)?.refire_reason}
            refireCount={ticket.items.find((i) => i.is_refire)?.refire_count}
          />
        )}

        {/* Allergen banner */}
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

        {/* Header */}
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
              {/* Expo badge */}
              <Badge variant="success" size="sm" className="font-[number:var(--weight-bold)] uppercase">
                EXPO
              </Badge>
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

        {/* Station status summary bar */}
        {Object.keys(stationStatuses).length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-[var(--color-border)] px-3 py-2">
            {Object.entries(stationStatuses).map(([stationName, status]) => (
              <Badge
                key={stationName}
                variant={status === 'complete' ? 'success' : 'default'}
                size="sm"
                className="uppercase font-[number:var(--weight-bold)]"
              >
                {status === 'complete' && (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
                {stationName}
              </Badge>
            ))}
          </div>
        )}

        {/* Items grouped by course */}
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
                      <Badge variant="default" size="sm" className="uppercase font-[number:var(--weight-bold)]">
                        HOLD
                      </Badge>
                    )}
                    {held && onFireCourse && (
                      <button
                        type="button"
                        onClick={() => onFireCourse(ticket.id, ticket.order_id, course)}
                        className="btn-press touch-target rounded-[var(--radius-xs)] px-2 py-0.5 text-caption-2 font-black uppercase text-white transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-border-focus)]"
                        style={{ backgroundColor: 'var(--color-warning-strong)', minHeight: 28 }}
                        aria-label={`Fire course ${course}`}
                      >
                        FIRE
                      </button>
                    )}
                    <div className="h-px flex-1 bg-[var(--color-border)]" />
                  </div>
                )}
                {idx > 0 && !hasMultipleCourses && (
                  <div className="my-1.5 h-px bg-[var(--color-border)]" />
                )}
                <div className={held ? 'opacity-40' : ''}>
                  {items.map((item) => (
                    <ExpoItemRow
                      key={item.id}
                      item={item}
                      onLongPressStart={handleItemLongPressStart}
                      onLongPressEnd={handleItemLongPressEnd}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Expo bump button -- larger, only active when ready to run.
            64pt for a confident grease-finger target; ui-v2 Button caps at 52
            so we keep this raw but use token colors. */}
        <button
          type="button"
          onClick={handleExpoBump}
          disabled={!isReadyToRun}
          className={cn(
            'btn-press touch-target m-3 flex flex-col items-center justify-center rounded-[var(--radius-md)] text-headline font-black uppercase tracking-wider transition-colors',
            'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-border-focus)]',
            !isReadyToRun && 'cursor-not-allowed',
          )}
          style={{
            height: 64,
            minHeight: 64,
            backgroundColor: isReadyToRun ? 'var(--color-success-strong)' : 'var(--color-bg-muted)',
            color: isReadyToRun ? 'var(--color-kds-text)' : 'var(--color-text-subtle)',
          }}
          title={
            !isReadyToRun
              ? `Waiting on: ${[...pendingStations].join(', ')}`
              : 'Bump order - mark as ready'
          }
          aria-label={isReadyToRun ? 'Bump order — ready to run' : 'Waiting on stations'}
        >
          <span>{isReadyToRun ? 'BUMP - READY' : 'WAITING'}</span>
          {!isReadyToRun && pendingStations.size > 0 && (
            <span className="mt-0.5 text-caption-1 font-semibold normal-case tracking-normal text-[var(--color-text-muted)]">
              Pending: {[...pendingStations].join(', ')}
            </span>
          )}
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

/** Expo item row with station origin label */
function ExpoItemRow({
  item,
  onLongPressStart,
  onLongPressEnd,
}: {
  item: KdsTicketItem
  onLongPressStart: (item: KdsTicketItem) => void
  onLongPressEnd: () => void
}) {
  const isBumped = item.is_bumped || item.status === 'completed'
  const isVoided = item.is_void
  const isRefire = item.is_refire
  const stationLabel = item.station_label ?? item.prep_station ?? ''

  return (
    <div
      className={cn(
        'mb-2 flex items-start gap-2.5',
        isVoided && 'opacity-40',
        isBumped && !isVoided && 'opacity-60'
      )}
      onTouchStart={() => onLongPressStart(item)}
      onTouchEnd={onLongPressEnd}
      onTouchCancel={onLongPressEnd}
      onMouseDown={() => onLongPressStart(item)}
      onMouseUp={onLongPressEnd}
      onMouseLeave={onLongPressEnd}
    >
      {/* Quantity */}
      <span
        className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-subhead font-bold text-[var(--color-text)]"
        style={{ backgroundColor: 'var(--color-bg-muted)' }}
      >
        {item.quantity}
      </span>

      {/* Item info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
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
            <Badge size="sm" className="font-[number:var(--weight-bold)] !text-white" style={{ backgroundColor: 'var(--color-kds-priority-refire)' }}>
              RE-FIRE
            </Badge>
          )}
          {isVoided && (
            <span className="text-caption-1 font-bold" style={{ color: 'var(--color-danger-strong)' }}>
              (VOIDED)
            </span>
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
      </div>

      {/* Station origin badge */}
      {stationLabel && (
        <span
          className={cn(
            'mt-0.5 flex-shrink-0 rounded-[var(--radius-xs)] px-2 py-0.5 text-caption-2 font-black uppercase text-white',
            isBumped ? 'bg-[var(--color-success-strong)]' : getStationColor(stationLabel)
          )}
        >
          {stationLabel.toUpperCase()}
        </span>
      )}

      {/* Completion indicator */}
      <div className="flex-shrink-0">
        {isVoided ? (
          <div className="flex h-8 w-8 items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" style={{ color: 'var(--color-danger-strong)' }}>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </div>
        ) : isBumped ? (
          <div className="flex h-8 w-8 items-center justify-center animate-fade-in">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" style={{ color: 'var(--color-success-strong)' }}>
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
        ) : (
          <div className="flex h-8 w-8 items-center justify-center">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: 'var(--color-border-strong)' }} />
          </div>
        )}
      </div>
    </div>
  )
}

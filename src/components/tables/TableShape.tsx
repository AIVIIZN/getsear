'use client'

import { cn } from '@/lib/utils'

type TableStatus =
  | 'available'
  | 'seated'
  | 'ordered'
  | 'served'
  | 'check_presented'
  | 'dirty'
  | 'reserved'
  | 'needs_attention'

type ShapeType = 'square' | 'round' | 'rectangle' | 'booth' | 'bar'

interface TableShapeProps {
  id: string
  name: string
  capacity: number
  shape: ShapeType
  status: TableStatus
  width: number
  height: number
  serverName: string | null
  guestCount: number
  seatedAt: string | null
  isEditMode: boolean
  isSelected: boolean
  onTap: (id: string) => void
  onResizeStart?: (id: string, handle: 'se' | 'sw' | 'ne' | 'nw', e: React.PointerEvent) => void
}

// Apple-inspired status colors — softer, not alarming
const STATUS_STYLES: Record<TableStatus, { bg: string; border: string; text: string; badge: string }> = {
  available: {
    bg: 'bg-white',
    border: 'border-[var(--gray-300)]',
    text: 'text-[var(--color-text-muted)]',
    badge: 'bg-[var(--color-success-strong)]',
  },
  seated: {
    bg: 'bg-[var(--color-primary-soft)]',
    border: 'border-[var(--color-primary)]',
    text: 'text-[var(--color-text)]',
    badge: 'bg-[var(--color-primary)]',
  },
  ordered: {
    bg: 'bg-[var(--color-success-soft)]',
    border: 'border-[var(--color-success-strong)]',
    text: 'text-[var(--color-text)]',
    badge: 'bg-[var(--color-success-strong)]',
  },
  served: {
    bg: 'bg-[var(--color-purple-soft)]',
    border: 'border-[var(--color-purple)]',
    text: 'text-[var(--color-text)]',
    badge: 'bg-[var(--color-purple)]',
  },
  check_presented: {
    bg: 'bg-[var(--color-warning-soft)]',
    border: 'border-[var(--color-warning-strong)]',
    text: 'text-[var(--color-text)]',
    badge: 'bg-[var(--color-warning-strong)]',
  },
  dirty: {
    bg: 'bg-[var(--color-bg-muted)]',
    border: 'border-[var(--gray-400)]',
    text: 'text-[var(--color-text-muted)]',
    badge: 'bg-[var(--color-text-muted)]',
  },
  reserved: {
    bg: 'bg-[var(--gray-200)]',
    border: 'border-[var(--color-indigo)]',
    text: 'text-[var(--color-indigo)]',
    badge: 'bg-[var(--color-indigo)]',
  },
  needs_attention: {
    bg: 'bg-[var(--color-danger-soft)]',
    border: 'border-[var(--color-danger-strong)]',
    text: 'text-[var(--color-danger-strong)]',
    badge: 'bg-[var(--color-danger-strong)]',
  },
}

const SHAPE_RADIUS: Record<ShapeType, string> = {
  square: 'rounded-xl',
  round: 'rounded-full',
  rectangle: 'rounded-xl',
  booth: 'rounded-t-xl rounded-b-md',
  bar: 'rounded-full',
}

function getElapsedTime(seatedAt: string | null): string {
  if (!seatedAt) return ''
  const diff = Date.now() - new Date(seatedAt).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '<1m'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  const remainMins = mins % 60
  return `${hours}h${remainMins > 0 ? ` ${remainMins}m` : ''}`
}

function getTimeColor(seatedAt: string | null): string {
  if (!seatedAt) return 'text-[var(--color-text-muted)]'
  const mins = Math.floor((Date.now() - new Date(seatedAt).getTime()) / 60000)
  if (mins < 30) return 'text-[var(--color-success-strong)]'   // Green — on time
  if (mins < 60) return 'text-[var(--color-warning-strong)]'   // Orange — getting long
  return 'text-[var(--color-danger-strong)]'                   // Red — overdue
}

export function TableShape({
  id,
  name,
  capacity,
  shape,
  status,
  width,
  height,
  serverName,
  guestCount,
  seatedAt,
  isEditMode,
  isSelected,
  onTap,
  onResizeStart,
}: TableShapeProps) {
  const minWidth = Math.max(width, 72)
  const minHeight = Math.max(height, 72)
  const isOccupied = !['available', 'dirty', 'reserved'].includes(status)
  const elapsed = getElapsedTime(seatedAt)
  const timeColor = getTimeColor(seatedAt)
  const styles = STATUS_STYLES[status]

  return (
    <button
      type="button"
      onClick={() => onTap(id)}
      className={cn(
        'absolute flex flex-col items-center justify-center transition-all duration-200',
        'border-2',
        styles.bg,
        styles.border,
        SHAPE_RADIUS[shape],
        // Depth — subtle shadow for available, stronger for occupied
        !isOccupied && 'shadow-sm',
        'hover:shadow-lg hover:scale-[1.03] active:scale-[0.97]',
        status === 'needs_attention' && 'animate-pulse',
        isEditMode && 'cursor-grab border-dashed !border-[var(--color-primary)]',
        isSelected && 'ring-2 ring-[var(--color-primary)] ring-offset-2 ring-offset-[var(--color-bg-muted)]',
      )}
      style={{
        width: minWidth,
        height: minHeight,
        ...(isOccupied ? {
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1), inset 0 1px 3px rgba(0,0,0,0.06)',
        } : {}),
      }}
    >
      {/* Table name — large and bold */}
      <span className={cn('text-base font-bold leading-none', styles.text)}>
        {name}
      </span>

      {/* Guest count or capacity */}
      {isOccupied && guestCount > 0 ? (
        <span className={cn('mt-1 text-xs font-semibold leading-none', styles.text)}>
          {guestCount}/{capacity}
        </span>
      ) : (
        <span className="mt-1 text-xs font-medium leading-none text-[var(--gray-400)]">
          {capacity} seats
        </span>
      )}

      {/* Server name chip */}
      {isOccupied && serverName && (
        <span className="mt-1.5 max-w-[calc(100%-8px)] truncate rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-medium leading-none text-[var(--color-text-secondary)]">
          {serverName}
        </span>
      )}

      {/* Elapsed time — color-coded (green→orange→red) */}
      {isOccupied && elapsed && (
        <span className={cn('mt-1 text-[11px] font-bold leading-none tabular-nums', timeColor)}>
          {elapsed}
        </span>
      )}

      {/* Reserved badge */}
      {status === 'reserved' && (
        <span className="mt-1 text-[10px] font-semibold leading-none text-[var(--color-indigo)]">
          Reserved
        </span>
      )}

      {/* Status dot — top-right corner */}
      <div
        className={cn(
          'absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white',
          styles.badge,
        )}
      />

      {/* Edit mode drag handle */}
      {isEditMode && (
        <div className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-primary)] text-white shadow-sm">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <circle cx="3" cy="3" r="1.2" />
            <circle cx="7" cy="3" r="1.2" />
            <circle cx="3" cy="7" r="1.2" />
            <circle cx="7" cy="7" r="1.2" />
          </svg>
        </div>
      )}

      {/* Resize handles — 4 corners, edit mode only */}
      {isEditMode && onResizeStart && (
        <>
          {/* NW */}
          <div
            className="absolute h-2 w-2 rounded-full bg-[var(--color-primary)] shadow-sm"
            style={{ top: -4, left: -4, cursor: 'nwse-resize' }}
            onPointerDown={(e) => { e.stopPropagation(); onResizeStart(id, 'nw', e) }}
          />
          {/* NE */}
          <div
            className="absolute h-2 w-2 rounded-full bg-[var(--color-primary)] shadow-sm"
            style={{ top: -4, right: -4, cursor: 'nesw-resize' }}
            onPointerDown={(e) => { e.stopPropagation(); onResizeStart(id, 'ne', e) }}
          />
          {/* SW */}
          <div
            className="absolute h-2 w-2 rounded-full bg-[var(--color-primary)] shadow-sm"
            style={{ bottom: -4, left: -4, cursor: 'nesw-resize' }}
            onPointerDown={(e) => { e.stopPropagation(); onResizeStart(id, 'sw', e) }}
          />
          {/* SE */}
          <div
            className="absolute h-2 w-2 rounded-full bg-[var(--color-primary)] shadow-sm"
            style={{ bottom: -4, right: -4, cursor: 'nwse-resize' }}
            onPointerDown={(e) => { e.stopPropagation(); onResizeStart(id, 'se', e) }}
          />
        </>
      )}
    </button>
  )
}

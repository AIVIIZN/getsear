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
    border: 'border-[#D1D1D6]',
    text: 'text-[#8E8E93]',
    badge: 'bg-[#34C759]',
  },
  seated: {
    bg: 'bg-[#E3F0FB]',
    border: 'border-[#007AFF]',
    text: 'text-[#1C1C1E]',
    badge: 'bg-[#007AFF]',
  },
  ordered: {
    bg: 'bg-[#E8F7D4]',
    border: 'border-[#34C759]',
    text: 'text-[#1C1C1E]',
    badge: 'bg-[#34C759]',
  },
  served: {
    bg: 'bg-[#F1E3FD]',
    border: 'border-[#AF52DE]',
    text: 'text-[#1C1C1E]',
    badge: 'bg-[#AF52DE]',
  },
  check_presented: {
    bg: 'bg-[#FFF8E1]',
    border: 'border-[#FF9500]',
    text: 'text-[#1C1C1E]',
    badge: 'bg-[#FF9500]',
  },
  dirty: {
    bg: 'bg-[#F2F2F7]',
    border: 'border-[#C7C7CC]',
    text: 'text-[#8E8E93]',
    badge: 'bg-[#8E8E93]',
  },
  reserved: {
    bg: 'bg-[#E5E5EA]',
    border: 'border-[#5856D6]',
    text: 'text-[#5856D6]',
    badge: 'bg-[#5856D6]',
  },
  needs_attention: {
    bg: 'bg-[#FFE6E9]',
    border: 'border-[#FF3B30]',
    text: 'text-[#FF3B30]',
    badge: 'bg-[#FF3B30]',
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
  if (!seatedAt) return 'text-[#8E8E93]'
  const mins = Math.floor((Date.now() - new Date(seatedAt).getTime()) / 60000)
  if (mins < 30) return 'text-[#34C759]'   // Green — on time
  if (mins < 60) return 'text-[#FF9500]'   // Orange — getting long
  return 'text-[#FF3B30]'                   // Red — overdue
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
        isEditMode && 'cursor-grab border-dashed !border-[#007AFF]',
        isSelected && 'ring-2 ring-[#007AFF] ring-offset-2 ring-offset-[#F2F2F7]',
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
        <span className="mt-1 text-xs font-medium leading-none text-[#C7C7CC]">
          {capacity} seats
        </span>
      )}

      {/* Server name chip */}
      {isOccupied && serverName && (
        <span className="mt-1.5 max-w-[calc(100%-8px)] truncate rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-medium leading-none text-[#3C3C43]">
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
        <span className="mt-1 text-[10px] font-semibold leading-none text-[#5856D6]">
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
        <div className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#007AFF] text-white shadow-sm">
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
            className="absolute h-2 w-2 rounded-full bg-[#007AFF] shadow-sm"
            style={{ top: -4, left: -4, cursor: 'nwse-resize' }}
            onPointerDown={(e) => { e.stopPropagation(); onResizeStart(id, 'nw', e) }}
          />
          {/* NE */}
          <div
            className="absolute h-2 w-2 rounded-full bg-[#007AFF] shadow-sm"
            style={{ top: -4, right: -4, cursor: 'nesw-resize' }}
            onPointerDown={(e) => { e.stopPropagation(); onResizeStart(id, 'ne', e) }}
          />
          {/* SW */}
          <div
            className="absolute h-2 w-2 rounded-full bg-[#007AFF] shadow-sm"
            style={{ bottom: -4, left: -4, cursor: 'nesw-resize' }}
            onPointerDown={(e) => { e.stopPropagation(); onResizeStart(id, 'sw', e) }}
          />
          {/* SE */}
          <div
            className="absolute h-2 w-2 rounded-full bg-[#007AFF] shadow-sm"
            style={{ bottom: -4, right: -4, cursor: 'nwse-resize' }}
            onPointerDown={(e) => { e.stopPropagation(); onResizeStart(id, 'se', e) }}
          />
        </>
      )}
    </button>
  )
}

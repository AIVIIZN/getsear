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
}

const STATUS_BG: Record<TableStatus, string> = {
  available: 'bg-[var(--table-available)]',
  seated: 'bg-[var(--table-seated)]',
  ordered: 'bg-[var(--table-ordered)]',
  served: 'bg-[var(--table-served)]',
  check_presented: 'bg-[var(--table-check-presented)]',
  dirty: 'bg-[var(--table-dirty)]',
  reserved: 'bg-[var(--table-reserved)]',
  needs_attention: 'bg-[var(--table-needs-attention)]',
}

const SHAPE_RADIUS: Record<ShapeType, string> = {
  square: 'rounded-lg',
  round: 'rounded-full',
  rectangle: 'rounded-lg',
  booth: 'rounded-t-lg rounded-b-none',
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
}: TableShapeProps) {
  const minWidth = Math.max(width, 60)
  const minHeight = Math.max(height, 60)
  const isOccupied = !['available', 'dirty', 'reserved'].includes(status)
  const elapsed = getElapsedTime(seatedAt)

  return (
    <button
      type="button"
      onClick={() => onTap(id)}
      className={cn(
        'absolute flex flex-col items-center justify-center transition-colors duration-300 touch-target no-select',
        STATUS_BG[status],
        SHAPE_RADIUS[shape],
        'text-white shadow-warm-sm',
        'hover:brightness-110 active:scale-[0.97]',
        status === 'needs_attention' && 'animate-pulse-attention',
        isEditMode && 'cursor-grab border-2 border-dashed border-white/50',
        isSelected && 'ring-2 ring-white ring-offset-2 ring-offset-background',
      )}
      style={{
        width: minWidth,
        height: minHeight,
      }}
    >
      {/* Table name */}
      <span className="text-sm font-bold leading-none">{name}</span>

      {/* Guest count or capacity */}
      {isOccupied && guestCount > 0 ? (
        <span className="mt-0.5 text-[10px] font-medium leading-none opacity-90">
          {guestCount}/{capacity}
        </span>
      ) : (
        <span className="mt-0.5 text-[10px] font-medium leading-none opacity-75">
          {capacity}
        </span>
      )}

      {/* Server name (truncated) */}
      {isOccupied && serverName && (
        <span className="mt-0.5 max-w-full truncate px-1 text-[9px] leading-none opacity-80">
          {serverName}
        </span>
      )}

      {/* Elapsed time */}
      {isOccupied && elapsed && (
        <span className="mt-0.5 text-[9px] font-medium leading-none opacity-70">
          {elapsed}
        </span>
      )}

      {/* Edit mode drag handle indicator */}
      {isEditMode && (
        <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[8px] text-gray-700 shadow-sm">
          +
        </div>
      )}
    </button>
  )
}

'use client'

import { useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/StatusBadge'

type TableStatus =
  | 'available'
  | 'seated'
  | 'ordered'
  | 'served'
  | 'check_presented'
  | 'dirty'
  | 'reserved'
  | 'needs_attention'

interface TablePopoverProps {
  tableId: string
  name: string
  status: TableStatus
  capacity: number
  guestCount: number
  serverName: string | null
  seatedAt: string | null
  currentOrderId: string | null
  posX: number
  posY: number
  width: number
  height: number
  canvasRect: DOMRect | null
  onClose: () => void
  onNewOrder: (tableId: string) => void
  onViewOrder: (tableId: string, orderId: string) => void
  onClear: (tableId: string) => void
  onSeat: (tableId: string) => void
}

function getElapsedTime(seatedAt: string | null): string {
  if (!seatedAt) return ''
  const diff = Date.now() - new Date(seatedAt).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  const remainMins = mins % 60
  return `${hours}h ${remainMins}m`
}

export function TablePopover({
  tableId,
  name,
  status,
  capacity,
  guestCount,
  serverName,
  seatedAt,
  currentOrderId,
  posX,
  posY,
  width,
  height,
  canvasRect,
  onClose,
  onNewOrder,
  onViewOrder,
  onClear,
  onSeat,
}: TablePopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Calculate popover position
  const popoverWidth = 240
  const popoverEstimatedHeight = 200
  let left = posX + width / 2 - popoverWidth / 2
  let top = posY + height + 8

  // Ensure popover stays within canvas bounds
  if (canvasRect) {
    if (left < 8) left = 8
    if (left + popoverWidth > canvasRect.width - 8) {
      left = canvasRect.width - popoverWidth - 8
    }
    if (top + popoverEstimatedHeight > canvasRect.height - 8) {
      top = posY - popoverEstimatedHeight - 8
    }
    if (top < 8) top = 8
  }

  const isOccupied = !['available', 'dirty', 'reserved'].includes(status)
  const elapsed = getElapsedTime(seatedAt)

  return (
    <div
      ref={popoverRef}
      className="absolute z-50 rounded-lg bg-popover p-3 shadow-warm-lg ring-1 ring-foreground/10"
      style={{
        left,
        top,
        width: popoverWidth,
      }}
    >
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">{name}</h3>
        <StatusBadge status={status} />
      </div>

      {/* Details */}
      <div className="mb-3 space-y-1 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Capacity</span>
          <span className="font-medium text-foreground">{capacity}</span>
        </div>
        {isOccupied && guestCount > 0 && (
          <div className="flex justify-between">
            <span>Guests</span>
            <span className="font-medium text-foreground">{guestCount}</span>
          </div>
        )}
        {isOccupied && serverName && (
          <div className="flex justify-between">
            <span>Server</span>
            <span className="font-medium text-foreground">{serverName}</span>
          </div>
        )}
        {isOccupied && elapsed && (
          <div className="flex justify-between">
            <span>Seated</span>
            <span className="font-medium text-foreground">{elapsed}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1.5">
        {status === 'available' && (
          <>
            <Button
              size="sm"
              className="h-8 w-full text-xs"
              onClick={() => onSeat(tableId)}
            >
              Seat Guests
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-full text-xs"
              onClick={() => onNewOrder(tableId)}
            >
              New Order
            </Button>
          </>
        )}

        {isOccupied && currentOrderId && (
          <Button
            size="sm"
            className="h-8 w-full text-xs"
            onClick={() => onViewOrder(tableId, currentOrderId)}
          >
            View Order
          </Button>
        )}

        {isOccupied && !currentOrderId && (
          <Button
            size="sm"
            className="h-8 w-full text-xs"
            onClick={() => onNewOrder(tableId)}
          >
            New Order
          </Button>
        )}

        {(status === 'dirty' || isOccupied) && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-full text-xs"
            onClick={() => onClear(tableId)}
          >
            {status === 'dirty' ? 'Mark Available' : 'Clear Table'}
          </Button>
        )}

        {status === 'reserved' && (
          <Button
            size="sm"
            className="h-8 w-full text-xs"
            onClick={() => onSeat(tableId)}
          >
            Seat Guests
          </Button>
        )}
      </div>
    </div>
  )
}

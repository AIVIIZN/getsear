'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { TableShape } from './TableShape'
import { TablePopover } from './TablePopover'

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

interface CanvasTable {
  id: string
  name: string
  capacity: number
  shape: ShapeType
  status: TableStatus
  pos_x: number
  pos_y: number
  width: number
  height: number
  rotation: number
  current_order_id: string | null
  current_server_id: string | null
  current_server_name: string | null
  guest_count: number
  seated_at: string | null
  section: string
}

interface DragState {
  tableId: string
  startX: number
  startY: number
  origX: number
  origY: number
}

interface ResizeState {
  tableId: string
  handle: 'se' | 'sw' | 'ne' | 'nw'
  startX: number
  startY: number
  origWidth: number
  origHeight: number
  origX: number
  origY: number
}

interface FloorPlanCanvasProps {
  tables: CanvasTable[]
  canvasWidth: number
  canvasHeight: number
  editMode: boolean
  onTablePositionChange: (tableId: string, x: number, y: number) => void
  onTableSizeChange?: (tableId: string, width: number, height: number, x: number, y: number) => void
  onNewOrder: (tableId: string) => void
  onViewOrder: (tableId: string, orderId: string) => void
  onClearTable: (tableId: string) => void
  onSeatTable: (tableId: string) => void
}

const GRID_SIZE = 20

function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE
}

export function FloorPlanCanvas({
  tables,
  canvasWidth,
  canvasHeight,
  editMode,
  onTablePositionChange,
  onTableSizeChange,
  onNewOrder,
  onViewOrder,
  onClearTable,
  onSeatTable,
}: FloorPlanCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [resizeState, setResizeState] = useState<ResizeState | null>(null)
  const [canvasRect, setCanvasRect] = useState<DOMRect | null>(null)

  // Measure canvas on mount and resize
  useEffect(() => {
    function measure() {
      if (canvasRef.current) {
        setCanvasRect(canvasRef.current.getBoundingClientRect())
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const selectedTable = tables.find((t) => t.id === selectedTableId) ?? null

  const handleTableTap = useCallback(
    (id: string) => {
      if (editMode) return // In edit mode, tap starts drag
      setSelectedTableId((prev) => (prev === id ? null : id))
    },
    [editMode]
  )

  const handleClosePopover = useCallback(() => {
    setSelectedTableId(null)
  }, [])

  // --- Drag logic for edit mode ---
  const handlePointerDown = useCallback(
    (e: React.PointerEvent, tableId: string) => {
      if (!editMode) return
      e.preventDefault()
      e.stopPropagation()

      const table = tables.find((t) => t.id === tableId)
      if (!table) return

      setDragState({
        tableId,
        startX: e.clientX,
        startY: e.clientY,
        origX: table.pos_x,
        origY: table.pos_y,
      })
      setSelectedTableId(tableId)
    },
    [editMode, tables]
  )

  // --- Resize logic for edit mode ---
  const handleResizeStart = useCallback(
    (tableId: string, handle: 'se' | 'sw' | 'ne' | 'nw', e: React.PointerEvent) => {
      if (!editMode) return
      e.preventDefault()
      e.stopPropagation()

      const table = tables.find((t) => t.id === tableId)
      if (!table) return

      setResizeState({
        tableId,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        origWidth: table.width,
        origHeight: table.height,
        origX: table.pos_x,
        origY: table.pos_y,
      })
      setSelectedTableId(tableId)
    },
    [editMode, tables]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!canvasRef.current) return
      if (!dragState && !resizeState) return
      e.preventDefault()

      const rect = canvasRef.current.getBoundingClientRect()
      const scaleX = canvasWidth / rect.width
      const scaleY = canvasHeight / rect.height

      if (resizeState && onTableSizeChange) {
        const dx = (e.clientX - resizeState.startX) * scaleX
        const dy = (e.clientY - resizeState.startY) * scaleY

        let newWidth = resizeState.origWidth
        let newHeight = resizeState.origHeight
        let newX = resizeState.origX
        let newY = resizeState.origY

        const { handle } = resizeState

        // Adjust width
        if (handle === 'se' || handle === 'ne') {
          newWidth = resizeState.origWidth + dx
        } else {
          newWidth = resizeState.origWidth - dx
          newX = resizeState.origX + dx
        }

        // Adjust height
        if (handle === 'se' || handle === 'sw') {
          newHeight = resizeState.origHeight + dy
        } else {
          newHeight = resizeState.origHeight - dy
          newY = resizeState.origY + dy
        }

        // Clamp and snap
        newWidth = snapToGrid(Math.max(48, Math.min(300, newWidth)))
        newHeight = snapToGrid(Math.max(48, Math.min(300, newHeight)))

        // Recalculate position for NW/SW/NE corners to keep opposite corner fixed
        if (handle === 'nw' || handle === 'sw') {
          newX = resizeState.origX + resizeState.origWidth - newWidth
        }
        if (handle === 'nw' || handle === 'ne') {
          newY = resizeState.origY + resizeState.origHeight - newHeight
        }

        newX = snapToGrid(Math.max(0, newX))
        newY = snapToGrid(Math.max(0, newY))

        onTableSizeChange(resizeState.tableId, newWidth, newHeight, newX, newY)
        return
      }

      if (dragState) {
        const dx = (e.clientX - dragState.startX) * scaleX
        const dy = (e.clientY - dragState.startY) * scaleY

        const newX = snapToGrid(Math.max(0, Math.min(canvasWidth - 40, dragState.origX + dx)))
        const newY = snapToGrid(Math.max(0, Math.min(canvasHeight - 40, dragState.origY + dy)))

        onTablePositionChange(dragState.tableId, newX, newY)
      }
    },
    [dragState, resizeState, canvasWidth, canvasHeight, onTablePositionChange, onTableSizeChange]
  )

  const handlePointerUp = useCallback(() => {
    setDragState(null)
    setResizeState(null)
  }, [])

  // Calculate scale to fit canvas into viewport
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  }

  const innerStyle: React.CSSProperties = {
    position: 'relative',
    width: canvasWidth,
    height: canvasHeight,
    transformOrigin: 'top left',
  }

  return (
    <div
      ref={canvasRef}
      className="relative h-full w-full"
      style={containerStyle}
      onPointerMove={editMode ? handlePointerMove : undefined}
      onPointerUp={editMode ? handlePointerUp : undefined}
      onPointerLeave={editMode ? handlePointerUp : undefined}
    >
      {/* Scalable inner canvas */}
      <div
        className="absolute inset-0"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={innerStyle}
          className="relative scale-[var(--canvas-scale)]"
          ref={(el) => {
            if (el && canvasRef.current) {
              const parent = canvasRef.current
              const scaleX = parent.clientWidth / canvasWidth
              const scaleY = parent.clientHeight / canvasHeight
              const scale = Math.min(scaleX, scaleY, 1)
              el.style.setProperty('--canvas-scale', String(scale))
              el.style.transform = `scale(${scale})`
            }
          }}
        >
          {/* Grid overlay in edit mode */}
          {editMode && (
            <>
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.06]"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, var(--border) 1px, transparent 1px),
                    linear-gradient(to bottom, var(--border) 1px, transparent 1px)
                  `,
                  backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
                }}
              />
              <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-[#007AFF]/10 px-2.5 py-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#007AFF]">
                  Edit Mode
                </span>
              </div>
            </>
          )}

          {/* Tables */}
          {tables.map((table) => (
            <div
              key={table.id}
              style={{
                position: 'absolute',
                left: table.pos_x,
                top: table.pos_y,
                transform: table.rotation ? `rotate(${table.rotation}deg)` : undefined,
              }}
              onPointerDown={editMode ? (e) => handlePointerDown(e, table.id) : undefined}
            >
              <TableShape
                id={table.id}
                name={table.name}
                capacity={table.capacity}
                shape={table.shape}
                status={table.status}
                width={table.width}
                height={table.height}
                serverName={table.current_server_name}
                guestCount={table.guest_count}
                seatedAt={table.seated_at}
                isEditMode={editMode}
                isSelected={selectedTableId === table.id}
                onTap={handleTableTap}
                onResizeStart={editMode ? handleResizeStart : undefined}
              />
            </div>
          ))}

          {/* Popover */}
          {selectedTable && !editMode && (
            <TablePopover
              tableId={selectedTable.id}
              name={selectedTable.name}
              status={selectedTable.status}
              capacity={selectedTable.capacity}
              guestCount={selectedTable.guest_count}
              serverName={selectedTable.current_server_name}
              seatedAt={selectedTable.seated_at}
              currentOrderId={selectedTable.current_order_id}
              posX={selectedTable.pos_x}
              posY={selectedTable.pos_y}
              width={selectedTable.width}
              height={selectedTable.height}
              canvasRect={canvasRect}
              onClose={handleClosePopover}
              onNewOrder={onNewOrder}
              onViewOrder={onViewOrder}
              onClear={onClearTable}
              onSeat={onSeatTable}
            />
          )}
        </div>
      </div>
    </div>
  )
}

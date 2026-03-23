'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MapPin } from 'lucide-react'

interface TableInfo {
  id: string
  name: string
  section_name: string | null
  status: string
  capacity: number
}

interface TableMoveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentTableId: string | null
  currentTableName: string | null
  locationId: string
  onMove: (newTableId: string, newTableName: string) => void
}

const STATUS_COLORS: Record<string, string> = {
  available: 'bg-[var(--success)]/15 text-[var(--success)] border-[var(--success)]/30',
  dirty: 'bg-[var(--muted)] text-muted-foreground border-border',
  reserved: 'bg-[var(--info-bg)] text-[var(--info)] border-[var(--info)]/30',
}

export function TableMoveDialog({
  open,
  onOpenChange,
  currentTableId,
  currentTableName,
  locationId,
  onMove,
}: TableMoveDialogProps) {
  const [tables, setTables] = useState<TableInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !locationId) return
    setSelected(null)
    setLoading(true)
    fetch(`/api/tables?location_id=${locationId}`)
      .then((r) => r.json())
      .then((json) => setTables(json.data ?? []))
      .catch(() => setTables([]))
      .finally(() => setLoading(false))
  }, [open, locationId])

  const handleConfirm = useCallback(() => {
    if (!selected) return
    const table = tables.find((t) => t.id === selected)
    if (table) {
      onMove(table.id, table.name)
      onOpenChange(false)
    }
  }, [selected, tables, onMove, onOpenChange])

  // Only show available/dirty tables (not ones that are occupied)
  const availableTables = tables.filter(
    (t) => t.id !== currentTableId && ['available', 'dirty', 'reserved'].includes(t.status)
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-[400px]! flex flex-col" showCloseButton={false}>
        <SheetHeader className="border-b border-border pb-4">
          <SheetTitle className="text-lg">Move to Table</SheetTitle>
          <SheetDescription>
            Current: <span className="font-medium text-foreground">{currentTableName ?? 'No table'}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
            </div>
          ) : availableTables.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No available tables found
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {availableTables.map((table) => (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => setSelected(table.id)}
                  className={cn(
                    'btn-press flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all duration-150',
                    selected === table.id
                      ? 'border-[var(--primary)] bg-[var(--accent)] ring-2 ring-[var(--primary)]/20'
                      : 'border-border bg-white hover:bg-[var(--secondary)]'
                  )}
                >
                  <span className="text-base font-bold text-foreground">{table.name}</span>
                  {table.section_name && (
                    <span className="text-[10px] text-muted-foreground mt-0.5">{table.section_name}</span>
                  )}
                  <span className="mt-1 text-xs text-muted-foreground">Cap: {table.capacity}</span>
                  <span
                    className={cn(
                      'mt-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize',
                      STATUS_COLORS[table.status] ?? 'bg-[var(--muted)] text-muted-foreground border-border'
                    )}
                  >
                    {table.status}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <SheetFooter className="border-t border-border gap-3 pt-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="btn-press touch-target-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <Button
            onClick={handleConfirm}
            disabled={!selected}
            className="btn-press touch-target-lg flex-1 h-14 rounded-xl text-base font-semibold bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] disabled:opacity-40"
          >
            <MapPin className="h-5 w-5 mr-2" />
            Move Table
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

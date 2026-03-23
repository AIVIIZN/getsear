'use client'

import { cn } from '@/lib/utils'
import { SectionColorPip } from './SectionColorPicker'

interface PickerTable {
  id: string
  name: string
  capacity: number
  status: string
  section_color?: string | null
  assigned_server_name?: string | null
}

interface TablePickerProps {
  tables: PickerTable[]
  minCapacity?: number
  selectedTableId: string | null
  highlightedTableId?: string | null
  onSelectTable: (tableId: string) => void
  className?: string
}

const STATUS_DOT_COLORS: Record<string, string> = {
  available: 'bg-green-500',
  seated: 'bg-blue-500',
  ordered: 'bg-amber-500',
  served: 'bg-purple-500',
  check_presented: 'bg-orange-500',
  dirty: 'bg-gray-400',
  reserved: 'bg-indigo-500',
}

/**
 * Reusable table selection grid.
 * Filters by capacity and status. Pre-assigned table is highlighted.
 */
export function TablePicker({
  tables,
  minCapacity = 1,
  selectedTableId,
  highlightedTableId,
  onSelectTable,
  className,
}: TablePickerProps) {
  // Filter to available tables with sufficient capacity
  const availableTables = tables.filter(
    (t) => t.status === 'available' && t.capacity >= minCapacity
  )

  // Also show the highlighted table even if not available
  const highlightedTable =
    highlightedTableId && !availableTables.find((t) => t.id === highlightedTableId)
      ? tables.find((t) => t.id === highlightedTableId)
      : null

  const displayTables = highlightedTable
    ? [highlightedTable, ...availableTables]
    : availableTables

  if (displayTables.length === 0) {
    return (
      <div className={cn('rounded-lg border border-dashed border-border p-6 text-center', className)}>
        <p className="text-sm text-muted-foreground">
          No available tables for this party size.
        </p>
      </div>
    )
  }

  return (
    <div className={cn('grid grid-cols-3 gap-2', className)}>
      {displayTables.map((table) => {
        const isSelected = selectedTableId === table.id
        const isHighlighted = highlightedTableId === table.id
        const isAvailable = table.status === 'available'

        return (
          <button
            key={table.id}
            type="button"
            onClick={() => isAvailable && onSelectTable(table.id)}
            disabled={!isAvailable}
            className={cn(
              'flex flex-col items-center rounded-xl border p-3 transition-all',
              isSelected
                ? 'border-primary bg-primary/5 ring-2 ring-primary'
                : isHighlighted
                  ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-400'
                  : isAvailable
                    ? 'border-border bg-card hover:border-primary/50 hover:bg-primary/5'
                    : 'cursor-not-allowed border-border/50 bg-muted/30 opacity-50',
            )}
          >
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  STATUS_DOT_COLORS[table.status] ?? 'bg-gray-400'
                )}
              />
              <span className="text-sm font-bold text-foreground">{table.name}</span>
              {table.section_color && (
                <SectionColorPip color={table.section_color} size="xs" />
              )}
            </div>
            <span className="mt-0.5 text-xs text-muted-foreground">
              Seats {table.capacity}
            </span>
            {isHighlighted && !isSelected && (
              <span className="mt-0.5 text-[10px] font-medium text-amber-600">
                Pre-assigned
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

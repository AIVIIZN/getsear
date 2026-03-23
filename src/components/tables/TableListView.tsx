'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TurnTimeBadge } from './TurnTimeBadge'
import { SectionColorPip } from './SectionColorPicker'
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Users,
  CreditCard,
  ChevronRight,
} from 'lucide-react'

type SortField =
  | 'name'
  | 'status'
  | 'server'
  | 'section'
  | 'guests'
  | 'time'
  | 'check'
type SortDirection = 'asc' | 'desc'

interface ListTable {
  id: string
  name: string
  capacity: number
  status: string
  guest_count: number
  seated_at: string | null
  current_server_name: string | null
  current_order_id: string | null
  section_color: string | null
  assigned_server_name: string | null
  check_total?: number
}

interface TableListViewProps {
  tables: ListTable[]
  onTableSelect: (tableId: string) => void
  onSeatTable: (tableId: string) => void
  onClearTable: (tableId: string) => void
  className?: string
}

const STATUS_DISPLAY: Record<
  string,
  { label: string; dotColor: string; sortOrder: number }
> = {
  available: { label: 'Available', dotColor: 'bg-green-500', sortOrder: 0 },
  reserved: { label: 'Reserved', dotColor: 'bg-indigo-500', sortOrder: 1 },
  seated: { label: 'Seated', dotColor: 'bg-blue-500', sortOrder: 2 },
  ordered: { label: 'Ordered', dotColor: 'bg-amber-500', sortOrder: 3 },
  served: { label: 'Served', dotColor: 'bg-purple-500', sortOrder: 4 },
  dessert: { label: 'Dessert', dotColor: 'bg-pink-500', sortOrder: 5 },
  check_presented: { label: 'Check', dotColor: 'bg-orange-500', sortOrder: 6 },
  dirty: { label: 'Dirty', dotColor: 'bg-gray-400', sortOrder: 7 },
  needs_attention: { label: 'Attention', dotColor: 'bg-red-500', sortOrder: 8 },
}

/**
 * Sortable, filterable data table alternative to floor plan.
 */
export function TableListView({
  tables,
  onTableSelect,
  onSeatTable,
  onClearTable,
  className,
}: TableListViewProps) {
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDirection>('asc')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [serverFilter, setServerFilter] = useState<string>('all')
  const [sectionFilter, setSectionFilter] = useState<string>('all')

  // Extract unique servers and sections for filter dropdowns
  const servers = useMemo(() => {
    const names = new Set<string>()
    for (const t of tables) {
      const name = t.current_server_name ?? t.assigned_server_name
      if (name) names.add(name)
    }
    return Array.from(names).sort()
  }, [tables])

  const sections = useMemo(() => {
    const colors = new Set<string>()
    for (const t of tables) {
      if (t.section_color) colors.add(t.section_color)
    }
    return Array.from(colors).sort()
  }, [tables])

  // Filter
  const filtered = useMemo(() => {
    let result = tables
    if (statusFilter !== 'all') {
      result = result.filter((t) => t.status === statusFilter)
    }
    if (serverFilter !== 'all') {
      result = result.filter(
        (t) =>
          (t.current_server_name ?? t.assigned_server_name) === serverFilter
      )
    }
    if (sectionFilter !== 'all') {
      result = result.filter((t) => t.section_color === sectionFilter)
    }
    return result
  }, [tables, statusFilter, serverFilter, sectionFilter])

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name, undefined, { numeric: true })
          break
        case 'status':
          cmp =
            (STATUS_DISPLAY[a.status]?.sortOrder ?? 99) -
            (STATUS_DISPLAY[b.status]?.sortOrder ?? 99)
          break
        case 'server':
          cmp = (a.current_server_name ?? '').localeCompare(
            b.current_server_name ?? ''
          )
          break
        case 'section':
          cmp = (a.section_color ?? '').localeCompare(b.section_color ?? '')
          break
        case 'guests':
          cmp = a.guest_count - b.guest_count
          break
        case 'time':
          cmp =
            new Date(a.seated_at ?? 0).getTime() -
            new Date(b.seated_at ?? 0).getTime()
          break
        case 'check':
          cmp = (a.check_total ?? 0) - (b.check_total ?? 0)
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [filtered, sortField, sortDir])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field)
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-30" />
    return sortDir === 'asc' ? (
      <ArrowUp className="ml-1 h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3" />
    )
  }

  if (tables.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8">
        <p className="text-sm text-muted-foreground">
          No tables configured -- go to Settings &gt; Tables to add your floor
          plan.
        </p>
      </div>
    )
  }

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Filters */}
      <div className="flex flex-shrink-0 items-center gap-2 px-4 py-2">
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
          <SelectTrigger className="h-9 w-[140px] text-xs">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_DISPLAY).map(([key, val]) => (
              <SelectItem key={key} value={key}>
                <span className="flex items-center gap-1.5">
                  <span className={cn('h-2 w-2 rounded-full', val.dotColor)} />
                  {val.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {sections.length > 0 && (
          <Select value={sectionFilter} onValueChange={(v) => v && setSectionFilter(v)}>
            <SelectTrigger className="h-9 w-[140px] text-xs">
              <SelectValue placeholder="All Sections" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sections</SelectItem>
              {sections.map((s) => (
                <SelectItem key={s} value={s}>
                  <span className="flex items-center gap-1.5">
                    <SectionColorPip color={s} size="sm" />
                    <span className="capitalize">{s}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {servers.length > 0 && (
          <Select value={serverFilter} onValueChange={(v) => v && setServerFilter(v)}>
            <SelectTrigger className="h-9 w-[140px] text-xs">
              <SelectValue placeholder="All Servers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Servers</SelectItem>
              {servers.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          {sorted.length} table{sorted.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-background">
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="w-[80px] p-3">
                <button
                  type="button"
                  className="flex items-center font-medium"
                  onClick={() => handleSort('name')}
                >
                  Table <SortIcon field="name" />
                </button>
              </th>
              <th className="w-[120px] p-3">
                <button
                  type="button"
                  className="flex items-center font-medium"
                  onClick={() => handleSort('status')}
                >
                  Status <SortIcon field="status" />
                </button>
              </th>
              <th className="w-[120px] p-3">
                <button
                  type="button"
                  className="flex items-center font-medium"
                  onClick={() => handleSort('server')}
                >
                  Server <SortIcon field="server" />
                </button>
              </th>
              <th className="w-[100px] p-3">
                <button
                  type="button"
                  className="flex items-center font-medium"
                  onClick={() => handleSort('section')}
                >
                  Section <SortIcon field="section" />
                </button>
              </th>
              <th className="w-[80px] p-3 text-center">
                <button
                  type="button"
                  className="flex items-center justify-center font-medium"
                  onClick={() => handleSort('guests')}
                >
                  Guests <SortIcon field="guests" />
                </button>
              </th>
              <th className="w-[100px] p-3">
                <button
                  type="button"
                  className="flex items-center font-medium"
                  onClick={() => handleSort('time')}
                >
                  Time <SortIcon field="time" />
                </button>
              </th>
              <th className="w-[100px] p-3 text-right">
                <button
                  type="button"
                  className="flex items-center justify-end font-medium"
                  onClick={() => handleSort('check')}
                >
                  Check <SortIcon field="check" />
                </button>
              </th>
              <th className="w-[48px] p-3" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((table) => {
              const statusInfo = STATUS_DISPLAY[table.status] ?? {
                label: table.status,
                dotColor: 'bg-gray-400',
              }
              const isOccupied = !['available', 'dirty', 'reserved'].includes(
                table.status
              )
              const serverName =
                table.current_server_name ?? table.assigned_server_name

              return (
                <tr
                  key={table.id}
                  className="cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/30 active:bg-muted/50"
                  style={{ height: 48 }}
                  onClick={() => onTableSelect(table.id)}
                >
                  <td className="p-3 text-sm font-bold text-foreground">
                    {table.name}
                  </td>
                  <td className="p-3">
                    <span className="flex items-center gap-1.5 text-sm">
                      <span
                        className={cn(
                          'h-2.5 w-2.5 rounded-full',
                          statusInfo.dotColor
                        )}
                      />
                      {statusInfo.label}
                    </span>
                  </td>
                  <td className="p-3">
                    {serverName ? (
                      <span className="flex items-center gap-1.5 text-sm">
                        {table.section_color && (
                          <SectionColorPip
                            color={table.section_color}
                            size="sm"
                          />
                        )}
                        {serverName}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">--</span>
                    )}
                  </td>
                  <td className="p-3">
                    {table.section_color ? (
                      <span className="flex items-center gap-1.5 text-sm capitalize">
                        <SectionColorPip
                          color={table.section_color}
                          size="md"
                        />
                        {table.section_color}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">--</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {isOccupied && table.guest_count > 0 ? (
                      <span className="text-sm tabular-nums">
                        {table.guest_count}/{table.capacity}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        --/{table.capacity}
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    {isOccupied && table.seated_at ? (
                      <TurnTimeBadge seatedAt={table.seated_at} />
                    ) : (
                      <span className="text-sm text-muted-foreground">--</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {table.check_total != null && table.check_total > 0 ? (
                      <span className="text-sm font-medium tabular-nums text-foreground">
                        ${(table.check_total / 100).toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">--</span>
                    )}
                  </td>
                  <td className="p-3">
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

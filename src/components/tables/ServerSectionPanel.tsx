'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  SectionColorPicker,
  SectionColorPip,
  SECTION_COLORS,
  SECTION_COLOR_MAP,
  type SectionColor,
} from './SectionColorPicker'
import { Users, X, Loader2, Check, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ServerData {
  id: string
  name: string
  color: SectionColor | null
  tableCount: number
}

interface TableData {
  id: string
  name: string
  capacity: number
  section_color: string | null
  assigned_server_id: string | null
}

interface ServerSectionPanelProps {
  tables: TableData[]
  onAssignmentsChanged: () => void
  onClose: () => void
}

/**
 * Manager panel for assigning tables to server sections with color coding.
 * Shows clocked-in servers on left, table grid on right.
 */
export function ServerSectionPanel({
  tables,
  onAssignmentsChanged,
  onClose,
}: ServerSectionPanelProps) {
  const [servers, setServers] = useState<ServerData[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null)
  const [selectedColor, setSelectedColor] = useState<SectionColor>(SECTION_COLORS[0])

  // Local assignment state: tableId -> { serverId, color }
  const [assignments, setAssignments] = useState<
    Map<string, { serverId: string; color: SectionColor }>
  >(new Map())

  // Initialize assignments from existing table data
  useEffect(() => {
    const initial = new Map<string, { serverId: string; color: SectionColor }>()
    for (const t of tables) {
      if (t.assigned_server_id && t.section_color) {
        initial.set(t.id, {
          serverId: t.assigned_server_id,
          color: t.section_color as SectionColor,
        })
      }
    }
    setAssignments(initial)
  }, [tables])

  // Fetch clocked-in servers
  useEffect(() => {
    async function fetchServers() {
      setLoading(true)
      try {
        const res = await fetch('/api/staff/clock?status=clocked_in')
        if (res.ok) {
          const json = await res.json()
          const clockedIn = (json.data ?? []) as Array<{
            user_id: string
            user_name?: string
            first_name?: string
            last_name?: string
          }>

          // Assign colors to existing server assignments
          const usedColors = new Map<string, SectionColor>()
          for (const [, assignment] of assignments) {
            usedColors.set(assignment.serverId, assignment.color)
          }

          let colorIdx = 0
          const serverList: ServerData[] = clockedIn.map((s) => {
            const name = s.user_name ?? `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() ?? 'Unknown'
            let color = usedColors.get(s.user_id) ?? null
            if (!color) {
              // Assign next available color
              while (
                colorIdx < SECTION_COLORS.length &&
                Array.from(usedColors.values()).includes(SECTION_COLORS[colorIdx])
              ) {
                colorIdx++
              }
              if (colorIdx < SECTION_COLORS.length) {
                color = SECTION_COLORS[colorIdx]
                colorIdx++
              }
            }
            return {
              id: s.user_id,
              name,
              color,
              tableCount: 0,
            }
          })

          // Count assigned tables
          for (const [, assignment] of assignments) {
            const server = serverList.find((s) => s.id === assignment.serverId)
            if (server) server.tableCount++
          }

          setServers(serverList)
        }
      } catch {
        // If staff API fails, show empty with a message
        setServers([])
      } finally {
        setLoading(false)
      }
    }
    fetchServers()
    // Only fetch once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update server table counts when assignments change
  useEffect(() => {
    setServers((prev) =>
      prev.map((s) => ({
        ...s,
        tableCount: Array.from(assignments.values()).filter(
          (a) => a.serverId === s.id
        ).length,
      }))
    )
  }, [assignments])

  const handleTableClick = useCallback(
    (tableId: string) => {
      if (!selectedServerId) return

      const server = servers.find((s) => s.id === selectedServerId)
      if (!server) return

      const currentAssignment = assignments.get(tableId)

      // Toggle: if already assigned to this server, unassign
      if (currentAssignment?.serverId === selectedServerId) {
        setAssignments((prev) => {
          const next = new Map(prev)
          next.delete(tableId)
          return next
        })
      } else {
        const color = server.color ?? selectedColor
        setAssignments((prev) => {
          const next = new Map(prev)
          next.set(tableId, { serverId: selectedServerId, color })
          return next
        })
      }
    },
    [selectedServerId, servers, assignments, selectedColor]
  )

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const assignmentList = Array.from(assignments.entries()).map(
        ([tableId, { serverId, color }]) => ({
          table_id: tableId,
          server_id: serverId,
          section_color: color,
        })
      )

      if (assignmentList.length > 0) {
        const res = await fetch('/api/tables/sections/assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignments: assignmentList }),
        })

        if (!res.ok) {
          toast.error('Failed to save section assignments')
          return
        }
      }

      // Clear unassigned tables
      const unassignedIds = tables
        .filter((t) => t.assigned_server_id && !assignments.has(t.id))
        .map((t) => t.id)

      if (unassignedIds.length > 0) {
        await fetch('/api/tables/sections/assign', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table_ids: unassignedIds }),
        })
      }

      toast.success('Section assignments saved')
      onAssignmentsChanged()
      onClose()
    } finally {
      setSaving(false)
    }
  }, [assignments, tables, onAssignmentsChanged, onClose])

  const unassignedTables = useMemo(
    () => tables.filter((t) => !assignments.has(t.id)),
    [tables, assignments]
  )

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="rounded-2xl bg-card p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 w-full max-w-2xl rounded-2xl bg-card shadow-warm-xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="text-headline font-bold text-foreground">
            Assign Server Sections
          </h3>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-1.5 h-4 w-4" />
              )}
              Done
            </Button>
          </div>
        </div>

        <div className="flex max-h-[70vh] min-h-[400px]">
          {/* Left: Servers */}
          <div className="w-56 flex-shrink-0 border-r border-border p-4">
            <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Clocked In
            </p>

            {servers.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No servers are clocked in. Sections will be available once staff
                clock in.
              </p>
            ) : (
              <div className="space-y-1.5">
                {servers.map((server) => {
                  const isSelected = selectedServerId === server.id
                  return (
                    <button
                      key={server.id}
                      type="button"
                      onClick={() => {
                        setSelectedServerId(
                          isSelected ? null : server.id
                        )
                        if (server.color) setSelectedColor(server.color)
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-xl p-2.5 text-left transition-all',
                        isSelected
                          ? 'bg-primary/10 ring-1 ring-primary'
                          : 'hover:bg-secondary'
                      )}
                    >
                      {server.color && (
                        <SectionColorPip color={server.color} size="md" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {server.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {server.tableCount} table
                          {server.tableCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Color picker */}
            {selectedServerId && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Section Color
                </p>
                <SectionColorPicker
                  selected={selectedColor}
                  onSelect={(c) => {
                    setSelectedColor(c)
                    // Update the server's color
                    setServers((prev) =>
                      prev.map((s) =>
                        s.id === selectedServerId ? { ...s, color: c } : s
                      )
                    )
                    // Update all assignments for this server
                    setAssignments((prev) => {
                      const next = new Map(prev)
                      for (const [tableId, assignment] of next) {
                        if (assignment.serverId === selectedServerId) {
                          next.set(tableId, { ...assignment, color: c })
                        }
                      }
                      return next
                    })
                  }}
                />
              </div>
            )}
          </div>

          {/* Right: Table grid */}
          <div className="flex-1 overflow-auto p-4">
            <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Tables {selectedServerId ? '(tap to assign)' : '(select a server first)'}
            </p>

            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {tables.map((table) => {
                const assignment = assignments.get(table.id)
                const isAssignedToSelected =
                  assignment?.serverId === selectedServerId
                const color = assignment?.color
                const sectionColor =
                  color ? SECTION_COLOR_MAP[color as SectionColor]?.cssVar : null
                const bgStyle = color
                  ? {
                      backgroundColor: `color-mix(in srgb, ${sectionColor ?? 'var(--color-border-fallback)'} 12%, transparent)`,
                      borderColor: sectionColor ?? 'var(--color-border-fallback)',
                    }
                  : {}

                return (
                  <button
                    key={table.id}
                    type="button"
                    onClick={() => handleTableClick(table.id)}
                    disabled={!selectedServerId}
                    className={cn(
                      'flex flex-col items-center rounded-xl border-2 p-2.5 transition-all',
                      assignment
                        ? 'border-solid'
                        : 'border-dashed border-border',
                      isAssignedToSelected && 'ring-2 ring-primary ring-offset-1',
                      !selectedServerId && 'cursor-default opacity-70',
                      selectedServerId && !assignment && 'hover:border-primary/50 hover:bg-primary/5',
                    )}
                    style={bgStyle}
                  >
                    <span className="text-sm font-bold text-foreground">
                      {table.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {table.capacity} seats
                    </span>
                    {assignment && (
                      <SectionColorPip
                        color={assignment.color}
                        size="sm"
                        className="mt-1"
                      />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Unassigned summary */}
            {unassignedTables.length > 0 && (
              <div className="mt-4 rounded-lg bg-secondary/50 p-2.5">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Unassigned:</span>{' '}
                  {unassignedTables.map((t) => t.name).join(', ')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useTableStore } from '@/stores/table-store'
import { useRealtimeTables } from '@/hooks/use-realtime'
import { FloorPlanCanvas } from '@/components/tables/FloorPlanCanvas'
import { SectionFilter } from '@/components/tables/SectionFilter'
import { StatusSummary } from '@/components/tables/StatusSummary'
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

interface FloorPlanData {
  id: string
  name: string
  canvas_width: number
  canvas_height: number
  sort_order: number
  is_active: boolean
}

interface TableData {
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
  floor_plan_id: string
}

// Seat dialog state
interface SeatDialogState {
  open: boolean
  tableId: string | null
  guestCount: number
}

// Add table dialog state
interface AddTableDialogState {
  open: boolean
  name: string
  capacity: number
  shape: ShapeType
}

export default function TablesPage() {
  const router = useRouter()
  const store = useTableStore()
  const { actions } = store

  const [floorPlans, setFloorPlans] = useState<FloorPlanData[]>([])
  const [tables, setTables] = useState<TableData[]>([])
  const [activeFloorPlanId, setActiveFloorPlanId] = useState<string | null>(null)
  const [activeSectionFilter, setActiveSectionFilter] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [seatDialog, setSeatDialog] = useState<SeatDialogState>({
    open: false,
    tableId: null,
    guestCount: 2,
  })
  const [addTableDialog, setAddTableDialog] = useState<AddTableDialogState>({
    open: false,
    name: '',
    capacity: 4,
    shape: 'square',
  })
  const [saving, setSaving] = useState(false)

  // Track pending position changes for bulk save
  const pendingChanges = useRef<Map<string, { pos_x: number; pos_y: number }>>(new Map())

  // Load floor plans
  useEffect(() => {
    async function loadFloorPlans() {
      try {
        const res = await fetch('/api/tables/floor-plans')
        if (!res.ok) return
        const json = await res.json()
        const plans = json.data as FloorPlanData[]
        setFloorPlans(plans)
        if (plans.length > 0 && !activeFloorPlanId) {
          setActiveFloorPlanId(plans[0].id)
        }
      } catch {
        // silently fail
      }
    }
    loadFloorPlans()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load tables + status summary when floor plan changes
  useEffect(() => {
    if (!activeFloorPlanId) {
      setLoading(false)
      return
    }

    async function loadFloorPlan() {
      setLoading(true)
      try {
        const [fpRes, summaryRes] = await Promise.all([
          fetch(`/api/tables/floor-plans/${activeFloorPlanId}`),
          fetch(`/api/tables/status-summary?floor_plan_id=${activeFloorPlanId}`),
        ])

        if (fpRes.ok) {
          const fpJson = await fpRes.json()
          setTables(fpJson.data.tables ?? [])
        }

        if (summaryRes.ok) {
          const summaryJson = await summaryRes.json()
          setStatusCounts(summaryJson.data.counts ?? {})
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }

    loadFloorPlan()
  }, [activeFloorPlanId])

  // Sync to zustand store
  useEffect(() => {
    actions.setTables(
      tables.map((t) => ({
        id: t.id,
        name: t.name,
        section: t.section,
        status: t.status,
        capacity: t.capacity,
        position_x: t.pos_x,
        position_y: t.pos_y,
        shape: { type: t.shape, width: t.width, height: t.height },
        current_order_id: t.current_order_id,
        current_server_id: t.current_server_id,
        current_server_name: t.current_server_name,
        guest_count: t.guest_count,
        seated_at: t.seated_at,
        floor_plan_id: t.floor_plan_id,
      }))
    )
  }, [tables, actions])

  // Real-time table updates
  const handleRealtimeUpdate = useCallback(
    (record: Record<string, unknown>) => {
      setTables((prev) =>
        prev.map((t) => {
          if (t.id === record.id) {
            return {
              ...t,
              status: (record.status as TableStatus) ?? t.status,
              current_order_id: (record.current_order_id as string | null) ?? t.current_order_id,
              current_server_id: (record.current_server_id as string | null) ?? t.current_server_id,
              guest_count: (record.guest_count as number) ?? t.guest_count,
              seated_at: (record.seated_at as string | null) ?? t.seated_at,
              pos_x: (record.pos_x as number) ?? t.pos_x,
              pos_y: (record.pos_y as number) ?? t.pos_y,
            }
          }
          return t
        })
      )

      // Update status counts
      const newStatus = record.status as string | undefined
      if (newStatus) {
        setStatusCounts((prev) => {
          // Find old status from current tables
          const oldTable = tables.find((t) => t.id === record.id)
          const oldStatus = oldTable?.status
          const updated = { ...prev }
          if (oldStatus && updated[oldStatus] > 0) {
            updated[oldStatus]--
          }
          updated[newStatus] = (updated[newStatus] ?? 0) + 1
          return updated
        })
      }
    },
    [tables]
  )

  useRealtimeTables(activeFloorPlanId ?? '', handleRealtimeUpdate)

  // Get unique sections from current tables
  const sections = [...new Set(tables.map((t) => t.section).filter(Boolean))].sort()

  // Filter tables by section
  const filteredTables = activeSectionFilter
    ? tables.filter((t) => t.section === activeSectionFilter)
    : tables

  // Get active floor plan canvas dimensions
  const activeFloorPlan = floorPlans.find((fp) => fp.id === activeFloorPlanId)
  const canvasWidth = activeFloorPlan?.canvas_width ?? 1200
  const canvasHeight = activeFloorPlan?.canvas_height ?? 800

  // Handle table position change (edit mode drag)
  const handleTablePositionChange = useCallback(
    (tableId: string, x: number, y: number) => {
      setTables((prev) =>
        prev.map((t) => (t.id === tableId ? { ...t, pos_x: x, pos_y: y } : t))
      )
      pendingChanges.current.set(tableId, { pos_x: x, pos_y: y })
    },
    []
  )

  // Save layout changes
  const handleSaveLayout = useCallback(async () => {
    if (pendingChanges.current.size === 0) {
      setEditMode(false)
      return
    }

    setSaving(true)
    try {
      const tableUpdates = Array.from(pendingChanges.current.entries()).map(
        ([id, pos]) => ({
          id,
          pos_x: pos.pos_x,
          pos_y: pos.pos_y,
        })
      )

      const res = await fetch('/api/tables/bulk-update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tables: tableUpdates }),
      })

      if (res.ok) {
        pendingChanges.current.clear()
        setEditMode(false)
      }
    } catch {
      // silently fail
    } finally {
      setSaving(false)
    }
  }, [])

  // Seat guests at table
  const handleSeatTable = useCallback((tableId: string) => {
    setSeatDialog({ open: true, tableId, guestCount: 2 })
  }, [])

  const handleSeatConfirm = useCallback(async () => {
    if (!seatDialog.tableId) return

    try {
      const res = await fetch(`/api/tables/${seatDialog.tableId}/seat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_count: seatDialog.guestCount }),
      })

      if (res.ok) {
        const json = await res.json()
        setTables((prev) =>
          prev.map((t) => (t.id === json.data.id ? { ...t, ...json.data } : t))
        )
      }
    } catch {
      // silently fail
    }
    setSeatDialog({ open: false, tableId: null, guestCount: 2 })
  }, [seatDialog])

  // Clear table
  const handleClearTable = useCallback(async (tableId: string) => {
    try {
      const table = tables.find((t) => t.id === tableId)
      const res = await fetch(`/api/tables/${tableId}/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_available: table?.status === 'dirty' }),
      })

      if (res.ok) {
        const json = await res.json()
        setTables((prev) =>
          prev.map((t) => (t.id === json.data.id ? { ...t, ...json.data } : t))
        )
      }
    } catch {
      // silently fail
    }
  }, [tables])

  // New order for table
  const handleNewOrder = useCallback(
    (tableId: string) => {
      router.push(`/orders?table_id=${tableId}`)
    },
    [router]
  )

  // View order
  const handleViewOrder = useCallback(
    (_tableId: string, orderId: string) => {
      router.push(`/orders?order_id=${orderId}`)
    },
    [router]
  )

  // Add table in edit mode
  const handleAddTableConfirm = useCallback(async () => {
    if (!activeFloorPlanId || !addTableDialog.name) return

    try {
      const res = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          floor_plan_id: activeFloorPlanId,
          name: addTableDialog.name,
          capacity: addTableDialog.capacity,
          shape: addTableDialog.shape,
          pos_x: 100,
          pos_y: 100,
          width: addTableDialog.shape === 'bar' ? 50 : addTableDialog.shape === 'rectangle' ? 120 : 80,
          height: addTableDialog.shape === 'bar' ? 50 : 80,
        }),
      })

      if (res.ok) {
        const json = await res.json()
        setTables((prev) => [...prev, { ...json.data, current_server_name: null }])
      }
    } catch {
      // silently fail
    }

    setAddTableDialog({ open: false, name: '', capacity: 4, shape: 'square' })
  }, [activeFloorPlanId, addTableDialog])

  // Delete table in edit mode
  const handleDeleteTable = useCallback(async (tableId: string) => {
    if (!confirm('Delete this table?')) return

    try {
      const res = await fetch(`/api/tables/${tableId}`, { method: 'DELETE' })
      if (res.ok) {
        setTables((prev) => prev.filter((t) => t.id !== tableId))
      }
    } catch {
      // silently fail
    }
  }, [])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <div
        className="flex flex-shrink-0 items-center gap-3 px-4"
        style={{ height: 'var(--topbar-height)', borderBottom: '0.5px solid var(--separator)' }}
      >
        {/* Floor plan tabs */}
        <div className="flex items-center gap-1.5">
          {floorPlans.map((fp) => (
            <button
              key={fp.id}
              type="button"
              onClick={() => setActiveFloorPlanId(fp.id)}
              className={cn(
                'btn-press touch-target rounded-xl px-4 py-2 text-subhead font-semibold transition-colors',
                activeFloorPlanId === fp.id
                  ? 'bg-primary text-primary-foreground shadow-warm-sm'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              {fp.name}
            </button>
          ))}
        </div>

        {/* Separator */}
        {floorPlans.length > 0 && sections.length > 0 && (
          <div className="h-6 w-px bg-border" />
        )}

        {/* Section filter */}
        <SectionFilter
          sections={sections}
          activeSection={activeSectionFilter}
          onSelect={setActiveSectionFilter}
        />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Status summary */}
        <StatusSummary counts={statusCounts} />

        {/* Separator */}
        <div className="h-6 w-px bg-border" />

        {/* Edit mode toggle */}
        {editMode ? (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => setAddTableDialog({ open: true, name: '', capacity: 4, shape: 'square' })}
            >
              Add Table
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs text-destructive"
              onClick={() => {
                pendingChanges.current.clear()
                setEditMode(false)
                // Reload to discard changes
                if (activeFloorPlanId) {
                  fetch(`/api/tables/floor-plans/${activeFloorPlanId}`)
                    .then((r) => r.json())
                    .then((json) => setTables(json.data.tables ?? []))
                    .catch(() => {})
                }
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs"
              disabled={saving}
              onClick={handleSaveLayout}
            >
              {saving ? 'Saving...' : 'Save Layout'}
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => setEditMode(true)}
          >
            Edit Layout
          </Button>
        )}
      </div>

      {/* Canvas area */}
      <div className="relative flex-1 overflow-hidden">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-sm text-muted-foreground">Loading floor plan...</div>
          </div>
        ) : floorPlans.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <p className="text-sm text-muted-foreground">No floor plans yet.</p>
            <Button
              size="sm"
              onClick={async () => {
                const res = await fetch('/api/tables/floor-plans', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: 'Main Dining' }),
                })
                if (res.ok) {
                  const json = await res.json()
                  setFloorPlans([json.data])
                  setActiveFloorPlanId(json.data.id)
                }
              }}
            >
              Create Floor Plan
            </Button>
          </div>
        ) : (
          <FloorPlanCanvas
            tables={filteredTables}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            editMode={editMode}
            onTablePositionChange={handleTablePositionChange}
            onNewOrder={handleNewOrder}
            onViewOrder={handleViewOrder}
            onClearTable={handleClearTable}
            onSeatTable={handleSeatTable}
          />
        )}
      </div>

      {/* Seat guests dialog */}
      {seatDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-backdrop">
          <div className="w-80 rounded-2xl bg-card p-6 shadow-warm-xl animate-fade-in">
            <h3 className="mb-4 text-headline text-foreground">Seat Guests</h3>

            <div className="mb-4">
              <label className="mb-1 block text-xs text-muted-foreground">Number of guests</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="touch-target flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-lg font-bold"
                  onClick={() =>
                    setSeatDialog((s) => ({
                      ...s,
                      guestCount: Math.max(1, s.guestCount - 1),
                    }))
                  }
                >
                  -
                </button>
                <span className="w-8 text-center text-xl font-bold tabular-nums">
                  {seatDialog.guestCount}
                </span>
                <button
                  type="button"
                  className="touch-target flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-lg font-bold"
                  onClick={() =>
                    setSeatDialog((s) => ({
                      ...s,
                      guestCount: Math.min(50, s.guestCount + 1),
                    }))
                  }
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setSeatDialog({ open: false, tableId: null, guestCount: 2 })}
              >
                Cancel
              </Button>
              <Button size="sm" className="flex-1" onClick={handleSeatConfirm}>
                Seat
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add table dialog (edit mode) */}
      {addTableDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-80 rounded-xl bg-card p-5 shadow-warm-xl">
            <h3 className="mb-4 text-sm font-bold text-foreground">Add Table</h3>

            <div className="mb-3">
              <label className="mb-1 block text-xs text-muted-foreground">Table name</label>
              <input
                type="text"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                placeholder="e.g., T1, B3"
                value={addTableDialog.name}
                onChange={(e) =>
                  setAddTableDialog((s) => ({ ...s, name: e.target.value }))
                }
              />
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-xs text-muted-foreground">Capacity</label>
              <input
                type="number"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                min={1}
                max={50}
                value={addTableDialog.capacity}
                onChange={(e) =>
                  setAddTableDialog((s) => ({
                    ...s,
                    capacity: parseInt(e.target.value, 10) || 4,
                  }))
                }
              />
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-xs text-muted-foreground">Shape</label>
              <div className="flex gap-1.5">
                {(['square', 'round', 'rectangle', 'booth', 'bar'] as const).map((shape) => (
                  <button
                    key={shape}
                    type="button"
                    onClick={() => setAddTableDialog((s) => ({ ...s, shape }))}
                    className={cn(
                      'touch-target flex-1 rounded-md px-2 py-1.5 text-xs font-medium capitalize transition-colors',
                      addTableDialog.shape === shape
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground',
                    )}
                  >
                    {shape}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() =>
                  setAddTableDialog({ open: false, name: '', capacity: 4, shape: 'square' })
                }
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1"
                disabled={!addTableDialog.name}
                onClick={handleAddTableConfirm}
              >
                Add
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

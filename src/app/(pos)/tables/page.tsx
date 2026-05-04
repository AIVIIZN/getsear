'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui-v2/Button'
import { Tabs } from '@/components/ui-v2/navigation/Tabs'
import { Segmented } from '@/components/ui-v2/inputs/Segmented'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
} from '@/components/ui-v2/Modal'
import { Text } from '@/components/ui-v2/inputs/Text'
import { NumberInput } from '@/components/ui-v2/inputs/Number'
import { Skeleton } from '@/components/ui-v2/data/Skeleton'
import { EmptyState } from '@/components/ui-v2/feedback/EmptyState'
import { useTableStore } from '@/stores/table-store'
import { useAuthStore } from '@/stores/auth-store'
import { useRealtimeTables } from '@/hooks/use-realtime'
import { FloorPlanCanvas } from '@/components/tables/FloorPlanCanvas'
import { TableListView } from '@/components/tables/TableListView'
import { CapacityDashboard } from '@/components/tables/CapacityDashboard'
import { ServerSectionPanel } from '@/components/tables/ServerSectionPanel'
import { WaitlistPanel } from '@/components/tables/WaitlistPanel'
import { ReservationSeatingFlow } from '@/components/tables/ReservationSeatingFlow'
import { SectionFilter } from '@/components/tables/SectionFilter'
import { StatusSummary } from '@/components/tables/StatusSummary'
import { LayoutGrid, List, BarChart3, Users2, Minus, Plus, LayoutDashboard } from 'lucide-react'

type ViewMode = 'floor' | 'list' | 'capacity'

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
  section_color: string | null
  assigned_server_id: string | null
  assigned_server_name: string | null
  floor_plan_id: string
  check_total?: number
}

interface SeatDialogState {
  open: boolean
  tableId: string | null
  guestCount: number
}

interface AddTableDialogState {
  open: boolean
  name: string
  capacity: number
  shape: ShapeType
}

interface SeatingFlowState {
  open: boolean
  reservation: {
    id: string
    customer_name: string
    party_size: number
    reservation_time: string
    table_id: string | null
    status: string
  } | null
}

const VIEW_MODE_TABS = [
  { value: 'floor', label: 'Floor Plan', icon: <LayoutGrid /> },
  { value: 'list', label: 'List', icon: <List /> },
  { value: 'capacity', label: 'Capacity', icon: <BarChart3 /> },
] as const

const SHAPE_OPTIONS = [
  { value: 'square' as const, label: 'Square' },
  { value: 'round' as const, label: 'Round' },
  { value: 'rectangle' as const, label: 'Rect' },
  { value: 'booth' as const, label: 'Booth' },
  { value: 'bar' as const, label: 'Bar' },
]

export default function TablesPage() {
  const router = useRouter()
  const store = useTableStore()
  const { actions } = store
  const activeLocationId = useAuthStore((s) => s.activeLocationId)

  const [viewMode, setViewMode] = useState<ViewMode>('floor')
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
  const [showSectionPanel, setShowSectionPanel] = useState(false)
  const [seatingFlow, setSeatingFlow] = useState<SeatingFlowState>({
    open: false,
    reservation: null,
  })
  const [creatingFloorPlan, setCreatingFloorPlan] = useState(false)

  const pendingChanges = useRef<Map<string, { pos_x: number; pos_y: number; width?: number; height?: number }>>(new Map())

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
        // silent
      }
    }
    loadFloorPlans()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        // silent
      } finally {
        setLoading(false)
      }
    }

    loadFloorPlan()
  }, [activeFloorPlanId])

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
              section_color: (record.section_color as string | null) ?? t.section_color,
              assigned_server_id: (record.assigned_server_id as string | null) ?? t.assigned_server_id,
            }
          }
          return t
        })
      )

      const newStatus = record.status as string | undefined
      if (newStatus) {
        setStatusCounts((prev) => {
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

  const sections = [...new Set(tables.map((t) => t.section).filter(Boolean))].sort()

  const filteredTables = activeSectionFilter
    ? tables.filter((t) => t.section === activeSectionFilter)
    : tables

  const activeFloorPlan = floorPlans.find((fp) => fp.id === activeFloorPlanId)
  const canvasWidth = activeFloorPlan?.canvas_width ?? 1200
  const canvasHeight = activeFloorPlan?.canvas_height ?? 800

  const handleTablePositionChange = useCallback(
    (tableId: string, x: number, y: number) => {
      setTables((prev) =>
        prev.map((t) => (t.id === tableId ? { ...t, pos_x: x, pos_y: y } : t))
      )
      const existing = pendingChanges.current.get(tableId)
      pendingChanges.current.set(tableId, { ...existing, pos_x: x, pos_y: y })
    },
    []
  )

  const handleTableSizeChange = useCallback(
    (tableId: string, width: number, height: number, x: number, y: number) => {
      setTables((prev) =>
        prev.map((t) => (t.id === tableId ? { ...t, width, height, pos_x: x, pos_y: y } : t))
      )
      const existing = pendingChanges.current.get(tableId)
      pendingChanges.current.set(tableId, { ...existing, pos_x: x, pos_y: y, width, height })
    },
    []
  )

  const handleSaveLayout = useCallback(async () => {
    if (pendingChanges.current.size === 0) {
      setEditMode(false)
      return
    }

    setSaving(true)
    try {
      const tableUpdates = Array.from(pendingChanges.current.entries()).map(
        ([id, changes]) => ({
          id,
          pos_x: changes.pos_x,
          pos_y: changes.pos_y,
          ...(changes.width != null && { width: changes.width }),
          ...(changes.height != null && { height: changes.height }),
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
      // silent
    } finally {
      setSaving(false)
    }
  }, [])

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
      // silent
    }
    setSeatDialog({ open: false, tableId: null, guestCount: 2 })
  }, [seatDialog])

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
      // silent
    }
  }, [tables])

  const handleNewOrder = useCallback(
    (tableId: string) => {
      router.push(`/orders?table_id=${tableId}`)
    },
    [router]
  )

  const handleViewOrder = useCallback(
    (_tableId: string, orderId: string) => {
      router.push(`/orders?order_id=${orderId}`)
    },
    [router]
  )

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
        setTables((prev) => [
          ...prev,
          {
            ...json.data,
            current_server_name: null,
            section_color: null,
            assigned_server_id: null,
            assigned_server_name: null,
          },
        ])
      }
    } catch {
      // silent
    }

    setAddTableDialog({ open: false, name: '', capacity: 4, shape: 'square' })
  }, [activeFloorPlanId, addTableDialog])

  const handleDeleteTable = useCallback(async (tableId: string) => {
    if (!confirm('Delete this table?')) return

    try {
      const res = await fetch(`/api/tables/${tableId}`, { method: 'DELETE' })
      if (res.ok) {
        setTables((prev) => prev.filter((t) => t.id !== tableId))
      }
    } catch {
      // silent
    }
  }, [])

  const handleSeatReservation = useCallback(
    (reservation: { id: string; customer_name: string; party_size: number; reservation_time: string; table_id: string | null; status: string }) => {
      setSeatingFlow({ open: true, reservation })
    },
    []
  )

  const handleSectionAssignmentChanged = useCallback(() => {
    if (activeFloorPlanId) {
      fetch(`/api/tables/floor-plans/${activeFloorPlanId}`)
        .then((r) => r.json())
        .then((json) => setTables(json.data.tables ?? []))
        .catch(() => {})
    }
  }, [activeFloorPlanId])

  const handleCreateFloorPlan = useCallback(async () => {
    if (creatingFloorPlan) return
    setCreatingFloorPlan(true)
    try {
      const res = await fetch('/api/tables/floor-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Main Dining', location_id: activeLocationId }),
      })
      if (res.ok) {
        const json = await res.json()
        setFloorPlans([json.data])
        setActiveFloorPlanId(json.data.id)
      }
    } catch {
      // silent
    } finally {
      setCreatingFloorPlan(false)
    }
  }, [activeLocationId, creatingFloorPlan])

  // Suppress unused-warning for delete handler retained for future inline-edit hookup
  void handleDeleteTable

  const floorPlanTabs = floorPlans.map((fp) => ({ value: fp.id, label: fp.name }))

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--color-bg)]">
      {/* Top bar */}
      <div
        className="flex flex-shrink-0 items-center gap-[var(--space-3)] px-[var(--space-4)]"
        style={{ height: 'var(--topbar-height)', borderBottom: '0.5px solid var(--color-border)' }}
      >
        <Segmented
          ariaLabel="View mode"
          options={VIEW_MODE_TABS.map((t) => ({
            value: t.value,
            label: t.label,
            icon: t.icon,
          }))}
          value={viewMode}
          onChange={(v) => setViewMode(v as ViewMode)}
          size="md"
        />

        <div className="h-6 w-px bg-[var(--color-border)]" />

        {viewMode === 'floor' && floorPlanTabs.length > 0 && (
          <Tabs
            variant="line"
            size="md"
            items={floorPlanTabs}
            value={activeFloorPlanId ?? floorPlanTabs[0].value}
            onValueChange={(v) => setActiveFloorPlanId(v)}
            ariaLabel="Floor plans"
            className="self-end"
          />
        )}

        {viewMode !== 'capacity' && sections.length > 0 && (
          <>
            <div className="h-6 w-px bg-[var(--color-border)]" />
            <SectionFilter
              sections={sections}
              activeSection={activeSectionFilter}
              onSelect={setActiveSectionFilter}
            />
          </>
        )}

        <div className="flex-1" />

        {viewMode !== 'capacity' && <StatusSummary counts={statusCounts} />}

        <div className="h-6 w-px bg-[var(--color-border)]" />

        <Button
          size="sm"
          variant="secondary"
          leadingIcon={<Users2 />}
          onClick={() => setShowSectionPanel(true)}
        >
          Sections
        </Button>

        {viewMode === 'floor' && (
          <>
            {editMode ? (
              <div className="flex items-center gap-[var(--space-2)]">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setAddTableDialog({ open: true, name: '', capacity: 4, shape: 'square' })}
                >
                  Add Table
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    pendingChanges.current.clear()
                    setEditMode(false)
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
                  variant="primary"
                  loading={saving}
                  onClick={handleSaveLayout}
                >
                  {saving ? 'Saving' : 'Save Layout'}
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setEditMode(true)}>
                Edit Layout
              </Button>
            )}
          </>
        )}
      </div>

      {/* Main content area */}
      <div className="relative flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex h-full flex-col gap-[var(--space-4)] p-[var(--space-6)]">
              <Skeleton variant="chart" className="h-[60%]" />
              <Skeleton variant="text" lines={3} />
            </div>
          ) : floorPlans.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <EmptyState
                icon={LayoutDashboard}
                title="No floor plans yet"
                description="Create a floor plan to start arranging tables and seating guests."
                action={{
                  label: creatingFloorPlan ? 'Creating' : 'Create Floor Plan',
                  onClick: handleCreateFloorPlan,
                }}
              />
            </div>
          ) : viewMode === 'floor' ? (
            <FloorPlanCanvas
              tables={filteredTables}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              editMode={editMode}
              onTablePositionChange={handleTablePositionChange}
              onTableSizeChange={handleTableSizeChange}
              onNewOrder={handleNewOrder}
              onViewOrder={handleViewOrder}
              onClearTable={handleClearTable}
              onSeatTable={handleSeatTable}
            />
          ) : viewMode === 'list' ? (
            <TableListView
              tables={filteredTables.map((t) => ({
                ...t,
                section_color: t.section_color ?? null,
                assigned_server_name: t.assigned_server_name ?? null,
              }))}
              onTableSelect={() => {
                setViewMode('floor')
              }}
              onSeatTable={handleSeatTable}
              onClearTable={handleClearTable}
            />
          ) : (
            <div className="h-full overflow-auto p-[var(--space-4)]">
              <CapacityDashboard tables={tables} onSeatReservation={handleSeatReservation} />
            </div>
          )}
        </div>

        {viewMode !== 'capacity' && (
          <div
            className="w-80 flex-shrink-0 overflow-auto bg-[var(--color-surface)] p-[var(--space-3)]"
            style={{ borderLeft: '0.5px solid var(--color-border)' }}
          >
            <WaitlistPanel onSeatEntry={() => handleSectionAssignmentChanged()} />
          </div>
        )}
      </div>

      {/* Seat guests modal */}
      <Modal
        open={seatDialog.open}
        onOpenChange={(open) =>
          setSeatDialog((s) => ({ ...s, open: open === true }))
        }
      >
        <ModalContent size="sm">
          <ModalHeader>
            <ModalTitle>Seat Guests</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-[var(--space-2)]">
              <span className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[var(--color-text)]">
                Number of guests
              </span>
              <div className="flex items-center justify-center gap-[var(--space-4)] py-[var(--space-2)]">
                <Button
                  size="lg"
                  variant="secondary"
                  aria-label="Decrease guests"
                  onClick={() =>
                    setSeatDialog((s) => ({
                      ...s,
                      guestCount: Math.max(1, s.guestCount - 1),
                    }))
                  }
                  className="h-[44px] w-[44px] p-0"
                >
                  <Minus />
                </Button>
                <span className="min-w-[3ch] text-center text-[length:var(--type-large-title-size)] font-[var(--weight-semibold)] tabular-nums text-[var(--color-text)]">
                  {seatDialog.guestCount}
                </span>
                <Button
                  size="lg"
                  variant="secondary"
                  aria-label="Increase guests"
                  onClick={() =>
                    setSeatDialog((s) => ({
                      ...s,
                      guestCount: Math.min(50, s.guestCount + 1),
                    }))
                  }
                  className="h-[44px] w-[44px] p-0"
                >
                  <Plus />
                </Button>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => setSeatDialog({ open: false, tableId: null, guestCount: 2 })}
            >
              Cancel
            </Button>
            <Button variant="primary" size="lg" onClick={handleSeatConfirm}>
              Seat
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Add table modal */}
      <Modal
        open={addTableDialog.open}
        onOpenChange={(open) =>
          setAddTableDialog((s) => ({ ...s, open: open === true }))
        }
      >
        <ModalContent size="sm">
          <ModalHeader>
            <ModalTitle>Add Table</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <Text
              size="lg"
              label="Table name"
              placeholder="e.g., T1, B3"
              value={addTableDialog.name}
              onChange={(e) => setAddTableDialog((s) => ({ ...s, name: e.target.value }))}
            />
            <NumberInput
              size="lg"
              label="Capacity"
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
            <div className="flex flex-col gap-[var(--space-2)]">
              <span className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[var(--color-text)]">
                Shape
              </span>
              <Segmented
                ariaLabel="Table shape"
                options={SHAPE_OPTIONS}
                value={addTableDialog.shape}
                onChange={(v) =>
                  setAddTableDialog((s) => ({ ...s, shape: v as ShapeType }))
                }
                size="lg"
                fullWidth
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="secondary"
              size="lg"
              onClick={() =>
                setAddTableDialog({ open: false, name: '', capacity: 4, shape: 'square' })
              }
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="lg"
              disabled={!addTableDialog.name}
              onClick={handleAddTableConfirm}
            >
              Add
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {showSectionPanel && (
        <ServerSectionPanel
          tables={tables.map((t) => ({
            id: t.id,
            name: t.name,
            capacity: t.capacity,
            section_color: t.section_color,
            assigned_server_id: t.assigned_server_id,
          }))}
          onAssignmentsChanged={handleSectionAssignmentChanged}
          onClose={() => setShowSectionPanel(false)}
        />
      )}

      {seatingFlow.open && seatingFlow.reservation && (
        <ReservationSeatingFlow
          reservation={seatingFlow.reservation}
          tables={tables.map((t) => ({
            id: t.id,
            name: t.name,
            capacity: t.capacity,
            status: t.status,
            section_color: t.section_color,
          }))}
          onSeated={() => {
            setSeatingFlow({ open: false, reservation: null })
            handleSectionAssignmentChanged()
          }}
          onClose={() => setSeatingFlow({ open: false, reservation: null })}
        />
      )}
    </div>
  )
}

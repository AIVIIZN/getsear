"use client"

import * as React from "react"
import { LaneDisplay } from "@/components/drive-thru/LaneDisplay"
import {
  Car,
  Plus,
  Loader2,
  Trash2,
  Timer,
  MonitorPlay,
  Clock,
  TrendingUp,
  Activity,
  Zap,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { EmptyState } from "@/components/shared/EmptyState"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SpeedMetrics {
  total_orders: number
  avg_total_seconds: number
  lanes: Array<{
    lane: number
    order_count: number
    avg_seconds: number
    min_seconds: number
    max_seconds: number
  }>
  hourly: Array<{
    hour: number
    order_count: number
    avg_seconds: number
  }>
}

interface MenuBoard {
  id: string
  org_id: string
  location_id: string
  name: string
  type: string
  schedule: Record<string, unknown> | null
  content: Record<string, unknown> | null
  is_active: boolean
  created_at: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatSeconds(s: number): string {
  const mins = Math.floor(s / 60)
  const secs = s % 60
  return `${mins}:${String(secs).padStart(2, "0")}`
}

function speedColor(seconds: number): string {
  if (seconds <= 120) return "text-green-600"
  if (seconds <= 180) return "text-amber-600"
  return "text-red-600"
}

function speedBg(seconds: number): string {
  if (seconds <= 120) return "bg-green-50"
  if (seconds <= 180) return "bg-amber-50"
  return "bg-red-50"
}

function formatHour(h: number): string {
  if (h === 0) return "12 AM"
  if (h < 12) return `${h} AM`
  if (h === 12) return "12 PM"
  return `${h - 12} PM`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function DriveThruPage() {
  const [tab, setTab] = React.useState("speed")

  // Speed metrics
  const [metrics, setMetrics] = React.useState<SpeedMetrics | null>(null)
  const [metricsLoading, setMetricsLoading] = React.useState(true)
  const [dateFrom, setDateFrom] = React.useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toISOString().split("T")[0]
  })
  const [dateTo, setDateTo] = React.useState(() => new Date().toISOString().split("T")[0])

  // Menu boards
  const [boards, setBoards] = React.useState<MenuBoard[]>([])
  const [boardsLoading, setBoardsLoading] = React.useState(true)
  const [boardSheetOpen, setBoardSheetOpen] = React.useState(false)
  const [editingBoard, setEditingBoard] = React.useState<MenuBoard | null>(null)
  const [saving, setSaving] = React.useState(false)

  // Board form
  const [boardName, setBoardName] = React.useState("")
  const [boardType, setBoardType] = React.useState("drive_thru")
  const [boardActive, setBoardActive] = React.useState(true)
  const [boardScheduleDesc, setBoardScheduleDesc] = React.useState("")

  // Delete
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [boardToDelete, setBoardToDelete] = React.useState<MenuBoard | null>(null)

  // -----------------------------------------------------------------------
  // Fetch
  // -----------------------------------------------------------------------
  const fetchMetrics = React.useCallback(async () => {
    setMetricsLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.set("date_from", dateFrom)
      if (dateTo) params.set("date_to", dateTo)
      const res = await fetch(`/api/drive-thru/orders/metrics?${params}`)
      if (res.ok) {
        const json = await res.json()
        setMetrics(json.data ?? null)
      }
    } finally {
      setMetricsLoading(false)
    }
  }, [dateFrom, dateTo])

  const fetchBoards = React.useCallback(async () => {
    setBoardsLoading(true)
    try {
      const res = await fetch("/api/drive-thru/menu-boards")
      if (res.ok) {
        const json = await res.json()
        setBoards(json.data ?? [])
      }
    } finally {
      setBoardsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchMetrics()
  }, [fetchMetrics])

  React.useEffect(() => {
    if (tab === "boards") fetchBoards()
  }, [tab, fetchBoards])

  // -----------------------------------------------------------------------
  // Board CRUD
  // -----------------------------------------------------------------------
  function openCreateBoard() {
    setEditingBoard(null)
    setBoardName("")
    setBoardType("drive_thru")
    setBoardActive(true)
    setBoardScheduleDesc("")
    setBoardSheetOpen(true)
  }

  function openEditBoard(b: MenuBoard) {
    setEditingBoard(b)
    setBoardName(b.name)
    setBoardType(b.type)
    setBoardActive(b.is_active)
    setBoardScheduleDesc("")
    setBoardSheetOpen(true)
  }

  async function handleSaveBoard() {
    setSaving(true)
    try {
      const payload = {
        name: boardName,
        type: boardType,
        is_active: boardActive,
        schedule: boardScheduleDesc ? { description: boardScheduleDesc } : null,
        location_id: "00000000-0000-0000-0000-000000000000", // placeholder
      }

      const url = editingBoard
        ? `/api/drive-thru/menu-boards/${editingBoard.id}`
        : "/api/drive-thru/menu-boards"

      const res = await fetch(url, {
        method: editingBoard ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        setBoardSheetOpen(false)
        fetchBoards()
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteBoard() {
    if (!boardToDelete) return
    setSaving(true)
    try {
      const res = await fetch(`/api/drive-thru/menu-boards/${boardToDelete.id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setDeleteDialogOpen(false)
        setBoardToDelete(null)
        fetchBoards()
      }
    } finally {
      setSaving(false)
    }
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Drive-Thru</h1>
        <p className="page-subtitle">
          Speed of service metrics and digital menu board management
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => v && setTab(v)}>
        <TabsList>
          <TabsTrigger value="lanes">
            <Car className="mr-2 h-4 w-4" />
            Lane Display
          </TabsTrigger>
          <TabsTrigger value="speed">
            <Timer className="mr-2 h-4 w-4" />
            Speed Metrics
          </TabsTrigger>
          <TabsTrigger value="boards">
            <MonitorPlay className="mr-2 h-4 w-4" />
            Menu Boards
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lanes" className="space-y-4">
          <LaneDisplay />
        </TabsContent>

        {/* ============================================================
            SPEED OF SERVICE TAB
            ============================================================ */}
        <TabsContent value="speed" className="space-y-4">
          {/* Date filters */}
          <div className="flex items-center gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[160px]"
              />
            </div>
          </div>

          {metricsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !metrics || metrics.total_orders === 0 ? (
            <EmptyState
              icon={Car}
              title="No drive-thru data"
              description="Drive-thru order tracking data will appear here once orders are processed."
            />
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-full p-2 ${speedBg(metrics.avg_total_seconds)}`}>
                        <Clock className={`h-5 w-5 ${speedColor(metrics.avg_total_seconds)}`} />
                      </div>
                      <div>
                        <p className={`text-2xl font-bold tabular-nums ${speedColor(metrics.avg_total_seconds)}`}>
                          {formatSeconds(metrics.avg_total_seconds)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Avg Total Time
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-blue-50 p-2">
                        <Car className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold tabular-nums">
                          {metrics.total_orders.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Cars Served
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-purple-50 p-2">
                        <Activity className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold tabular-nums">
                          {metrics.lanes.length}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Active Lanes
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Lane breakdown */}
              {metrics.lanes.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Lane Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Lane</TableHead>
                          <TableHead className="text-right">Orders</TableHead>
                          <TableHead className="text-right">Avg Time</TableHead>
                          <TableHead className="text-right">Best</TableHead>
                          <TableHead className="text-right">Worst</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {metrics.lanes.map((l) => (
                          <TableRow key={l.lane}>
                            <TableCell className="font-medium">
                              Lane {l.lane}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {l.order_count}
                            </TableCell>
                            <TableCell className={`text-right tabular-nums font-medium ${speedColor(l.avg_seconds)}`}>
                              {formatSeconds(l.avg_seconds)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-green-600">
                              {formatSeconds(l.min_seconds)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-red-600">
                              {formatSeconds(l.max_seconds)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Hourly breakdown */}
              {metrics.hourly.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Hourly Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {metrics.hourly.map((h) => {
                        const maxOrders = Math.max(
                          ...metrics.hourly.map((x) => x.order_count),
                        )
                        const widthPct =
                          maxOrders > 0
                            ? (h.order_count / maxOrders) * 100
                            : 0

                        return (
                          <div key={h.hour} className="flex items-center gap-3">
                            <span className="w-14 text-xs text-muted-foreground text-right">
                              {formatHour(h.hour)}
                            </span>
                            <div className="flex-1 h-6 bg-muted rounded overflow-hidden relative">
                              <div
                                className={`h-full rounded transition-all ${speedBg(h.avg_seconds).replace("bg-", "bg-")}`}
                                style={{ width: `${widthPct}%`, backgroundColor: h.avg_seconds <= 120 ? "#bbf7d0" : h.avg_seconds <= 180 ? "#fde68a" : "#fecaca" }}
                              />
                              <span className="absolute inset-0 flex items-center px-2 text-xs font-medium">
                                {h.order_count} orders &middot; {formatSeconds(h.avg_seconds)} avg
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ============================================================
            MENU BOARDS TAB
            ============================================================ */}
        <TabsContent value="boards" className="space-y-4">
          <div className="flex items-center justify-end">
            <Button onClick={openCreateBoard} className="btn-press">
              <Plus className="mr-2 h-4 w-4" />
              New Menu Board
            </Button>
          </div>

          {boardsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : boards.length === 0 ? (
            <EmptyState
              icon={MonitorPlay}
              title="No menu boards"
              description="Create digital menu board configurations for your drive-thru."
              actionLabel="New Menu Board"
              onAction={openCreateBoard}
            />
          ) : (
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boards.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-xs">
                          {b.type.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs ${b.is_active ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}
                        >
                          {b.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(b.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditBoard(b)}
                          >
                            <MonitorPlay className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => {
                              setBoardToDelete(b)
                              setDeleteDialogOpen(true)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ================================================================
          BOARD SHEET
          ================================================================ */}
      <Sheet open={boardSheetOpen} onOpenChange={setBoardSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editingBoard ? "Edit Menu Board" : "New Menu Board"}
            </SheetTitle>
            <SheetDescription>
              Configure digital menu board content and daypart scheduling.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>Board Name</Label>
              <Input
                value={boardName}
                onChange={(e) => setBoardName(e.target.value)}
                placeholder="e.g. Lane 1 Main Board"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={boardType} onValueChange={(v) => v && setBoardType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="drive_thru">Drive-Thru</SelectItem>
                  <SelectItem value="indoor">Indoor</SelectItem>
                  <SelectItem value="outdoor">Outdoor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Schedule / Daypart Notes</Label>
              <Textarea
                value={boardScheduleDesc}
                onChange={(e) => setBoardScheduleDesc(e.target.value)}
                rows={3}
                placeholder="e.g. Breakfast 5AM-11AM, Lunch 11AM-4PM, Dinner 4PM-Close"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="board-active"
                checked={boardActive}
                onChange={(e) => setBoardActive(e.target.checked)}
                className="rounded border-border"
              />
              <Label htmlFor="board-active">Active</Label>
            </div>
            <Separator />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBoardSheetOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveBoard}
                disabled={saving || !boardName}
                className="btn-press"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingBoard ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ================================================================
          DELETE BOARD DIALOG
          ================================================================ */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Menu Board</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{boardToDelete?.name}&rdquo;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteBoard}
              disabled={saving}
              className="btn-press"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

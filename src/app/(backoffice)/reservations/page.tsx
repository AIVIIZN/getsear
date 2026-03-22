"use client"

import * as React from "react"
import {
  CalendarDays,
  Clock,
  Plus,
  Users,
  Phone,
  Mail,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Bell,
  Armchair,
  X,
  MessageSquare,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState } from "@/components/shared/EmptyState"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Reservation {
  id: string
  org_id: string
  location_id: string
  customer_name: string
  customer_phone: string | null
  customer_email: string | null
  party_size: number
  reservation_date: string
  reservation_time: string
  table_id: string | null
  status: string
  notes: string | null
  special_requests: string | null
  confirmation_sent_at: string | null
  reminder_sent_at: string | null
  created_at: string
}

interface WaitlistEntry {
  id: string
  org_id: string
  location_id: string
  customer_name: string
  customer_phone: string | null
  party_size: number
  quoted_wait_minutes: number | null
  position: number
  status: string
  notes: string | null
  created_at: string
  seated_at: string | null
}

interface AvailableSlot {
  time: string
  available_tables: number
  total_tables: number
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  confirmed: "bg-blue-100 text-blue-800 border-blue-200",
  seated: "bg-green-100 text-green-800 border-green-200",
  completed: "bg-gray-100 text-gray-700 border-gray-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
  no_show: "bg-red-100 text-red-800 border-red-200",
}

const WAITLIST_STATUS_COLORS: Record<string, string> = {
  waiting: "bg-amber-100 text-amber-800 border-amber-200",
  notified: "bg-blue-100 text-blue-800 border-blue-200",
  seated: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-gray-100 text-gray-700 border-gray-200",
  no_show: "bg-red-100 text-red-800 border-red-200",
}

function formatTime(time: string): string {
  const [h, m] = time.split(":")
  const hour = parseInt(h, 10)
  const ampm = hour >= 12 ? "PM" : "AM"
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${h12}:${m} ${ampm}`
}

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function getMinutesAgo(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 60000)
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ReservationsPage() {
  // -- Tab state --
  const [activeTab, setActiveTab] = React.useState<string>("reservations")

  // -- Reservation state --
  const [reservations, setReservations] = React.useState<Reservation[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedDate, setSelectedDate] = React.useState(todayISO())
  const [statusFilter, setStatusFilter] = React.useState("all")

  // -- Waitlist state --
  const [waitlist, setWaitlist] = React.useState<WaitlistEntry[]>([])
  const [waitlistLoading, setWaitlistLoading] = React.useState(true)

  // -- Create reservation dialog --
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createLoading, setCreateLoading] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)
  const [resForm, setResForm] = React.useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    party_size: "2",
    reservation_date: todayISO(),
    reservation_time: "18:00",
    notes: "",
    special_requests: "",
  })

  // -- Add to waitlist dialog --
  const [waitlistAddOpen, setWaitlistAddOpen] = React.useState(false)
  const [waitlistAddLoading, setWaitlistAddLoading] = React.useState(false)
  const [waitlistForm, setWaitlistForm] = React.useState({
    customer_name: "",
    customer_phone: "",
    party_size: "2",
    quoted_wait_minutes: "15",
    notes: "",
  })

  // -- Detail sheet --
  const [selectedRes, setSelectedRes] = React.useState<Reservation | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [availableSlots, setAvailableSlots] = React.useState<AvailableSlot[]>([])
  const [slotsLoading, setSlotsLoading] = React.useState(false)

  // -- Action loading states --
  const [actionLoading, setActionLoading] = React.useState<string | null>(null)

  // ---- Fetch reservations ----
  const fetchReservations = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        date_from: selectedDate,
        date_to: selectedDate,
        limit: "100",
      })
      if (statusFilter !== "all") {
        params.set("status", statusFilter)
      }
      const res = await fetch(`/api/reservations?${params}`)
      if (res.ok) {
        const json = await res.json()
        setReservations(json.data ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [selectedDate, statusFilter])

  // ---- Fetch waitlist ----
  const fetchWaitlist = React.useCallback(async () => {
    setWaitlistLoading(true)
    try {
      const res = await fetch("/api/reservations/waitlist?status=waiting")
      if (res.ok) {
        const json = await res.json()
        setWaitlist(json.data ?? [])
      }
    } finally {
      setWaitlistLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchReservations()
  }, [fetchReservations])

  React.useEffect(() => {
    if (activeTab === "waitlist") {
      fetchWaitlist()
    }
  }, [activeTab, fetchWaitlist])

  // ---- Fetch availability slots ----
  const fetchSlots = React.useCallback(async (date: string, partySize: number) => {
    setSlotsLoading(true)
    try {
      const params = new URLSearchParams({
        date,
        party_size: String(partySize),
      })
      const res = await fetch(`/api/reservations/availability?${params}`)
      if (res.ok) {
        const json = await res.json()
        setAvailableSlots(json.data?.available_slots ?? [])
      }
    } finally {
      setSlotsLoading(false)
    }
  }, [])

  // ---- Navigate date ----
  function navigateDate(delta: number) {
    const d = new Date(selectedDate + "T00:00:00")
    d.setDate(d.getDate() + delta)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    setSelectedDate(iso)
  }

  // ---- Create reservation ----
  async function handleCreateReservation(e: React.FormEvent) {
    e.preventDefault()
    setCreateLoading(true)
    setCreateError(null)
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: resForm.customer_name,
          customer_phone: resForm.customer_phone || null,
          customer_email: resForm.customer_email || null,
          party_size: parseInt(resForm.party_size, 10),
          reservation_date: resForm.reservation_date,
          reservation_time: resForm.reservation_time,
          notes: resForm.notes || null,
          special_requests: resForm.special_requests || null,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        setCreateError(json.error ?? "Failed to create reservation")
        return
      }
      setCreateOpen(false)
      setResForm({
        customer_name: "",
        customer_phone: "",
        customer_email: "",
        party_size: "2",
        reservation_date: todayISO(),
        reservation_time: "18:00",
        notes: "",
        special_requests: "",
      })
      fetchReservations()
    } finally {
      setCreateLoading(false)
    }
  }

  // ---- Add to waitlist ----
  async function handleAddToWaitlist(e: React.FormEvent) {
    e.preventDefault()
    setWaitlistAddLoading(true)
    try {
      const res = await fetch("/api/reservations/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: waitlistForm.customer_name,
          customer_phone: waitlistForm.customer_phone || null,
          party_size: parseInt(waitlistForm.party_size, 10),
          quoted_wait_minutes: parseInt(waitlistForm.quoted_wait_minutes, 10),
          notes: waitlistForm.notes || null,
        }),
      })
      if (res.ok) {
        setWaitlistAddOpen(false)
        setWaitlistForm({
          customer_name: "",
          customer_phone: "",
          party_size: "2",
          quoted_wait_minutes: "15",
          notes: "",
        })
        fetchWaitlist()
      }
    } finally {
      setWaitlistAddLoading(false)
    }
  }

  // ---- Reservation actions ----
  async function confirmReservation(id: string) {
    setActionLoading(id)
    try {
      await fetch(`/api/reservations/${id}/confirm`, { method: "POST" })
      fetchReservations()
    } finally {
      setActionLoading(null)
    }
  }

  async function seatReservation(id: string) {
    setActionLoading(id)
    try {
      await fetch(`/api/reservations/${id}/seat`, { method: "POST" })
      fetchReservations()
      setSheetOpen(false)
    } finally {
      setActionLoading(null)
    }
  }

  async function cancelReservation(id: string) {
    setActionLoading(id)
    try {
      await fetch(`/api/reservations/${id}`, { method: "DELETE" })
      fetchReservations()
      setSheetOpen(false)
    } finally {
      setActionLoading(null)
    }
  }

  // ---- Waitlist actions ----
  async function notifyWaitlistEntry(id: string) {
    setActionLoading(id)
    try {
      await fetch(`/api/reservations/waitlist/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "notified" }),
      })
      fetchWaitlist()
    } finally {
      setActionLoading(null)
    }
  }

  async function seatWaitlistEntry(id: string) {
    setActionLoading(id)
    try {
      await fetch(`/api/reservations/waitlist/${id}/seat`, { method: "POST" })
      fetchWaitlist()
    } finally {
      setActionLoading(null)
    }
  }

  async function cancelWaitlistEntry(id: string) {
    setActionLoading(id)
    try {
      await fetch(`/api/reservations/waitlist/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      })
      fetchWaitlist()
    } finally {
      setActionLoading(null)
    }
  }

  // ---- Open reservation detail ----
  function openDetail(r: Reservation) {
    setSelectedRes(r)
    setSheetOpen(true)
    fetchSlots(r.reservation_date, r.party_size)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reservations</h1>
          <p className="text-sm text-muted-foreground">
            Manage reservations and walk-in waitlist
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="reservations" onValueChange={(v) => v && setActiveTab(v)}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="reservations">
              <CalendarDays className="mr-1.5 h-4 w-4" />
              Reservations
            </TabsTrigger>
            <TabsTrigger value="waitlist">
              <Clock className="mr-1.5 h-4 w-4" />
              Waitlist
              {waitlist.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                  {waitlist.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {activeTab === "reservations" ? (
            <Button className="btn-press touch-target" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              New Reservation
            </Button>
          ) : (
            <Button className="btn-press touch-target" onClick={() => setWaitlistAddOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add to Waitlist
            </Button>
          )}
        </div>

        {/* ========================== RESERVATIONS TAB ========================== */}
        <TabsContent value="reservations">
          {/* Date navigation + filters */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="touch-target"
                onClick={() => navigateDate(-1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-10 w-auto"
              />
              <Button
                variant="outline"
                size="icon"
                className="touch-target"
                onClick={() => navigateDate(1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="touch-target"
                onClick={() => setSelectedDate(todayISO())}
              >
                Today
              </Button>
            </div>

            <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
              <SelectTrigger className="h-10 w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="seated">Seated</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="no_show">No Show</SelectItem>
              </SelectContent>
            </Select>

            <span className="text-sm text-muted-foreground">
              {formatDate(selectedDate)} &middot; {reservations.length} reservation{reservations.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Reservations table */}
          <div className="mt-4 rounded-lg border bg-card">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : reservations.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No reservations"
                description={`No reservations found for ${formatDate(selectedDate)}.`}
                actionLabel="New Reservation"
                onAction={() => setCreateOpen(true)}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Time</TableHead>
                    <TableHead>Guest</TableHead>
                    <TableHead className="w-[80px] text-center">Party</TableHead>
                    <TableHead className="w-[110px]">Status</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-[200px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservations.map((r) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openDetail(r)}
                    >
                      <TableCell className="font-medium tabular-nums">
                        {formatTime(r.reservation_time)}
                      </TableCell>
                      <TableCell className="font-medium">{r.customer_name}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          {r.party_size}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={STATUS_COLORS[r.status] ?? ""}
                        >
                          {r.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.customer_phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {r.customer_phone}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {r.special_requests || r.notes || "--"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {r.status === "pending" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="touch-target"
                              disabled={actionLoading === r.id}
                              onClick={() => confirmReservation(r.id)}
                            >
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                              Confirm
                            </Button>
                          )}
                          {(r.status === "pending" || r.status === "confirmed") && (
                            <Button
                              size="sm"
                              className="touch-target"
                              disabled={actionLoading === r.id}
                              onClick={() => seatReservation(r.id)}
                            >
                              <Armchair className="mr-1 h-3.5 w-3.5" />
                              Seat
                            </Button>
                          )}
                          {r.status !== "cancelled" && r.status !== "completed" && r.status !== "no_show" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="touch-target text-destructive hover:text-destructive"
                              disabled={actionLoading === r.id}
                              onClick={() => cancelReservation(r.id)}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* ========================== WAITLIST TAB ========================== */}
        <TabsContent value="waitlist">
          <div className="mt-4 rounded-lg border bg-card">
            {waitlistLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : waitlist.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="Waitlist is empty"
                description="No guests currently waiting. Add walk-ins to the waitlist."
                actionLabel="Add to Waitlist"
                onAction={() => setWaitlistAddOpen(true)}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px] text-center">#</TableHead>
                    <TableHead>Guest</TableHead>
                    <TableHead className="w-[80px] text-center">Party</TableHead>
                    <TableHead className="w-[120px]">Quoted Wait</TableHead>
                    <TableHead className="w-[120px]">Actual Wait</TableHead>
                    <TableHead className="w-[110px]">Status</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="w-[280px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {waitlist.map((w) => {
                    const minutesWaiting = getMinutesAgo(w.created_at)
                    const isOverQuoted = w.quoted_wait_minutes !== null && minutesWaiting > w.quoted_wait_minutes
                    return (
                      <TableRow key={w.id}>
                        <TableCell className="text-center font-bold tabular-nums">
                          {w.position}
                        </TableCell>
                        <TableCell className="font-medium">{w.customer_name}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                            {w.party_size}
                          </div>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {w.quoted_wait_minutes !== null ? `${w.quoted_wait_minutes} min` : "--"}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`tabular-nums font-medium ${isOverQuoted ? "text-destructive" : "text-foreground"}`}
                          >
                            {minutesWaiting} min
                          </span>
                          {isOverQuoted && (
                            <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-destructive" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={WAITLIST_STATUS_COLORS[w.status] ?? ""}
                          >
                            {w.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {w.customer_phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {w.customer_phone}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {w.status === "waiting" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="touch-target"
                                disabled={actionLoading === w.id}
                                onClick={() => notifyWaitlistEntry(w.id)}
                              >
                                <Bell className="mr-1 h-3.5 w-3.5" />
                                Notify
                              </Button>
                            )}
                            {(w.status === "waiting" || w.status === "notified") && (
                              <Button
                                size="sm"
                                className="touch-target"
                                disabled={actionLoading === w.id}
                                onClick={() => seatWaitlistEntry(w.id)}
                              >
                                <Armchair className="mr-1 h-3.5 w-3.5" />
                                Seat
                              </Button>
                            )}
                            {w.status === "waiting" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="touch-target text-destructive hover:text-destructive"
                                disabled={actionLoading === w.id}
                                onClick={() => cancelWaitlistEntry(w.id)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ========================== CREATE RESERVATION DIALOG ========================== */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Reservation</DialogTitle>
            <DialogDescription>
              Create a reservation for a guest.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateReservation} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="res-name">Guest Name *</Label>
              <Input
                id="res-name"
                placeholder="Full name"
                value={resForm.customer_name}
                onChange={(e) => setResForm((f) => ({ ...f, customer_name: e.target.value }))}
                className="h-12"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="res-phone">Phone</Label>
                <Input
                  id="res-phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={resForm.customer_phone}
                  onChange={(e) => setResForm((f) => ({ ...f, customer_phone: e.target.value }))}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="res-email">Email</Label>
                <Input
                  id="res-email"
                  type="email"
                  placeholder="guest@example.com"
                  value={resForm.customer_email}
                  onChange={(e) => setResForm((f) => ({ ...f, customer_email: e.target.value }))}
                  className="h-12"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="res-party">Party Size</Label>
                <Input
                  id="res-party"
                  type="number"
                  min={1}
                  max={100}
                  value={resForm.party_size}
                  onChange={(e) => setResForm((f) => ({ ...f, party_size: e.target.value }))}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="res-date">Date</Label>
                <Input
                  id="res-date"
                  type="date"
                  value={resForm.reservation_date}
                  onChange={(e) => setResForm((f) => ({ ...f, reservation_date: e.target.value }))}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="res-time">Time</Label>
                <Input
                  id="res-time"
                  type="time"
                  value={resForm.reservation_time}
                  onChange={(e) => setResForm((f) => ({ ...f, reservation_time: e.target.value }))}
                  className="h-12"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="res-special">Special Requests</Label>
              <Textarea
                id="res-special"
                placeholder="Allergies, accessibility needs, celebrations..."
                value={resForm.special_requests}
                onChange={(e) => setResForm((f) => ({ ...f, special_requests: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="res-notes">Internal Notes</Label>
              <Textarea
                id="res-notes"
                placeholder="Staff-only notes..."
                value={resForm.notes}
                onChange={(e) => setResForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>

            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createLoading} className="btn-press">
                {createLoading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Create Reservation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================== ADD TO WAITLIST DIALOG ========================== */}
      <Dialog open={waitlistAddOpen} onOpenChange={setWaitlistAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add to Waitlist</DialogTitle>
            <DialogDescription>
              Add a walk-in guest to the waitlist.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddToWaitlist} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wl-name">Guest Name *</Label>
              <Input
                id="wl-name"
                placeholder="Full name"
                value={waitlistForm.customer_name}
                onChange={(e) => setWaitlistForm((f) => ({ ...f, customer_name: e.target.value }))}
                className="h-12"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wl-phone">Phone</Label>
              <Input
                id="wl-phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={waitlistForm.customer_phone}
                onChange={(e) => setWaitlistForm((f) => ({ ...f, customer_phone: e.target.value }))}
                className="h-12"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="wl-party">Party Size</Label>
                <Input
                  id="wl-party"
                  type="number"
                  min={1}
                  max={100}
                  value={waitlistForm.party_size}
                  onChange={(e) => setWaitlistForm((f) => ({ ...f, party_size: e.target.value }))}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wl-wait">Quoted Wait (min)</Label>
                <Input
                  id="wl-wait"
                  type="number"
                  min={0}
                  value={waitlistForm.quoted_wait_minutes}
                  onChange={(e) => setWaitlistForm((f) => ({ ...f, quoted_wait_minutes: e.target.value }))}
                  className="h-12"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wl-notes">Notes</Label>
              <Textarea
                id="wl-notes"
                placeholder="Preferences, special needs..."
                value={waitlistForm.notes}
                onChange={(e) => setWaitlistForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setWaitlistAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={waitlistAddLoading} className="btn-press">
                {waitlistAddLoading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Add to Waitlist
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================== RESERVATION DETAIL SHEET ========================== */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Reservation Details</SheetTitle>
            <SheetDescription>
              View and manage this reservation.
            </SheetDescription>
          </SheetHeader>

          {selectedRes && (
            <ScrollArea className="mt-4 h-[calc(100vh-120px)] pr-4">
              <div className="space-y-6">
                {/* Guest info */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">{selectedRes.customer_name}</h3>
                  <Badge
                    variant="outline"
                    className={`${STATUS_COLORS[selectedRes.status] ?? ""} text-sm`}
                  >
                    {selectedRes.status.replace("_", " ")}
                  </Badge>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="flex items-center gap-2 text-sm">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      {formatDate(selectedRes.reservation_date)}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {formatTime(selectedRes.reservation_time)}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      Party of {selectedRes.party_size}
                    </div>
                    {selectedRes.customer_phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        {selectedRes.customer_phone}
                      </div>
                    )}
                    {selectedRes.customer_email && (
                      <div className="col-span-2 flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {selectedRes.customer_email}
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Special requests */}
                {selectedRes.special_requests && (
                  <>
                    <div>
                      <h4 className="mb-1 text-sm font-medium text-muted-foreground">
                        Special Requests
                      </h4>
                      <p className="text-sm">{selectedRes.special_requests}</p>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Notes */}
                {selectedRes.notes && (
                  <>
                    <div>
                      <h4 className="mb-1 text-sm font-medium text-muted-foreground">
                        Internal Notes
                      </h4>
                      <p className="text-sm">{selectedRes.notes}</p>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Confirmation info */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Notifications
                  </h4>
                  <div className="text-sm">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                      Confirmation:{" "}
                      {selectedRes.confirmation_sent_at
                        ? new Date(selectedRes.confirmation_sent_at).toLocaleString()
                        : "Not sent"}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                      Reminder:{" "}
                      {selectedRes.reminder_sent_at
                        ? new Date(selectedRes.reminder_sent_at).toLocaleString()
                        : "Not sent"}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Available time slots for this date */}
                <div>
                  <h4 className="mb-2 text-sm font-medium text-muted-foreground">
                    Available Slots ({formatDate(selectedRes.reservation_date)})
                  </h4>
                  {slotsLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : availableSlots.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No available slots</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {availableSlots.map((slot) => (
                        <Badge
                          key={slot.time}
                          variant={slot.time === selectedRes.reservation_time ? "default" : "outline"}
                          className="cursor-default tabular-nums"
                        >
                          {formatTime(slot.time)} ({slot.available_tables})
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pb-8">
                  {selectedRes.status === "pending" && (
                    <Button
                      className="btn-press touch-target flex-1"
                      variant="outline"
                      disabled={actionLoading === selectedRes.id}
                      onClick={() => confirmReservation(selectedRes.id)}
                    >
                      <CheckCircle2 className="mr-1.5 h-4 w-4" />
                      Confirm
                    </Button>
                  )}
                  {(selectedRes.status === "pending" || selectedRes.status === "confirmed") && (
                    <Button
                      className="btn-press touch-target flex-1"
                      disabled={actionLoading === selectedRes.id}
                      onClick={() => seatReservation(selectedRes.id)}
                    >
                      <Armchair className="mr-1.5 h-4 w-4" />
                      Seat Guest
                    </Button>
                  )}
                  {selectedRes.status !== "cancelled" &&
                    selectedRes.status !== "completed" &&
                    selectedRes.status !== "no_show" && (
                      <Button
                        className="btn-press touch-target"
                        variant="outline"
                        disabled={actionLoading === selectedRes.id}
                        onClick={() => cancelReservation(selectedRes.id)}
                      >
                        <XCircle className="mr-1.5 h-4 w-4 text-destructive" />
                        Cancel
                      </Button>
                    )}
                </div>
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

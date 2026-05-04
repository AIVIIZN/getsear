"use client"

import * as React from "react"
import {
  CalendarDays,
  Clock,
  Plus,
  Users,
  Phone,
  Mail,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Bell,
  Armchair,
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MessageSquare,
} from "lucide-react"
import { Text } from "@/components/ui-v2/inputs/Text"
import { NumberInput } from "@/components/ui-v2/inputs/Number"
import { Email } from "@/components/ui-v2/inputs/Email"
import { Textarea } from "@/components/ui-v2/inputs/Textarea"
import { Select } from "@/components/ui-v2/inputs/Select"
import { Button } from "@/components/ui-v2/Button"
import { Badge, type BadgeProps } from "@/components/ui-v2/data/Badge"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui-v2/data/Table"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
} from "@/components/ui-v2/Sheet"
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from "@/components/ui-v2/Modal"
import { Tabs } from "@/components/ui-v2/navigation/Tabs"
import { EmptyState } from "@/components/ui-v2/feedback/EmptyState"

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

type BadgeVariant = NonNullable<BadgeProps["variant"]>

// ---------------------------------------------------------------------------
// Status helpers — token-backed Badge variants only.
// ---------------------------------------------------------------------------
const STATUS_VARIANT: Record<string, BadgeVariant> = {
  pending: "warning",
  confirmed: "info",
  seated: "success",
  completed: "default",
  cancelled: "danger",
  no_show: "danger",
}

const WAITLIST_STATUS_VARIANT: Record<string, BadgeVariant> = {
  waiting: "warning",
  notified: "info",
  seated: "success",
  cancelled: "default",
  no_show: "danger",
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
          <h1 className="page-title">Reservations</h1>
          <p className="page-subtitle">
            Manage reservations and walk-in waitlist
          </p>
        </div>
      </div>

      {/* Tabs row + primary action */}
      <div className="flex items-center justify-between gap-[var(--space-4)]">
        <Tabs
          variant="line"
          size="md"
          value={activeTab}
          onValueChange={setActiveTab}
          ariaLabel="Reservations sections"
          items={[
            {
              value: "reservations",
              label: "Reservations",
              icon: <CalendarDays />,
            },
            {
              value: "waitlist",
              label: (
                <span className="inline-flex items-center gap-[var(--space-1)]">
                  Waitlist
                  {waitlist.length > 0 ? (
                    <Badge variant="primary" size="sm">
                      {waitlist.length}
                    </Badge>
                  ) : null}
                </span>
              ),
              icon: <Clock />,
            },
          ]}
        />

        {activeTab === "reservations" ? (
          <Button size="md" leadingIcon={<Plus />} onClick={() => setCreateOpen(true)}>
            New Reservation
          </Button>
        ) : (
          <Button size="md" leadingIcon={<Plus />} onClick={() => setWaitlistAddOpen(true)}>
            Add to Waitlist
          </Button>
        )}
      </div>

      {/* ========================== RESERVATIONS PANEL ========================== */}
      {activeTab === "reservations" && (
        <div role="tabpanel" aria-label="Reservations" className="space-y-4">
          {/* Date navigation + filters */}
          <div className="flex flex-wrap items-center gap-[var(--space-3)]">
            <div className="flex items-center gap-[var(--space-1)]">
              <Button
                variant="secondary"
                size="md"
                aria-label="Previous day"
                onClick={() => navigateDate(-1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Text
                type="date"
                aria-label="Date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-auto"
              />
              <Button
                variant="secondary"
                size="md"
                aria-label="Next day"
                onClick={() => navigateDate(1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() => setSelectedDate(todayISO())}
              >
                Today
              </Button>
            </div>

            <Select
              size="md"
              ariaLabel="Status filter"
              value={statusFilter}
              onChange={setStatusFilter}
              className="w-[160px]"
              options={[
                { value: "all", label: "All Statuses" },
                { value: "pending", label: "Pending" },
                { value: "confirmed", label: "Confirmed" },
                { value: "seated", label: "Seated" },
                { value: "completed", label: "Completed" },
                { value: "cancelled", label: "Cancelled" },
                { value: "no_show", label: "No Show" },
              ]}
            />

            <span className="text-[length:var(--type-subhead-size)] text-[var(--color-text-muted)]">
              {formatDate(selectedDate)} &middot; {reservations.length} reservation
              {reservations.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Reservations table */}
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--color-text-muted)]" />
              </div>
            ) : reservations.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No reservations"
                description={`No reservations found for ${formatDate(selectedDate)}.`}
                action={{ label: "New Reservation", onClick: () => setCreateOpen(true) }}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell header className="w-[80px]">
                      Time
                    </TableCell>
                    <TableCell header>Guest</TableCell>
                    <TableCell header align="center" className="w-[80px]">
                      Party
                    </TableCell>
                    <TableCell header className="w-[110px]">
                      Status
                    </TableCell>
                    <TableCell header>Contact</TableCell>
                    <TableCell header>Notes</TableCell>
                    <TableCell header align="right" className="w-[200px]">
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservations.map((r) => (
                    <TableRow key={r.id} interactive onClick={() => openDetail(r)}>
                      <TableCell className="font-[var(--weight-medium)] tabular-nums">
                        {formatTime(r.reservation_time)}
                      </TableCell>
                      <TableCell className="font-[var(--weight-medium)]">
                        {r.customer_name}
                      </TableCell>
                      <TableCell align="center">
                        <span className="inline-flex items-center justify-center gap-[var(--space-1)]">
                          <Users className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                          {r.party_size}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[r.status] ?? "default"}>
                          {r.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[var(--color-text-muted)]">
                        {r.customer_phone && (
                          <span className="inline-flex items-center gap-[var(--space-1)]">
                            <Phone className="h-3 w-3" />
                            {r.customer_phone}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-[var(--color-text-muted)]">
                        {r.special_requests || r.notes || "--"}
                      </TableCell>
                      <TableCell align="right">
                        <div
                          className="flex items-center justify-end gap-[var(--space-1)]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {r.status === "pending" && (
                            <Button
                              variant="secondary"
                              size="sm"
                              loading={actionLoading === r.id}
                              leadingIcon={<CheckCircle2 />}
                              onClick={() => confirmReservation(r.id)}
                            >
                              Confirm
                            </Button>
                          )}
                          {(r.status === "pending" || r.status === "confirmed") && (
                            <Button
                              size="sm"
                              loading={actionLoading === r.id}
                              leadingIcon={<Armchair />}
                              onClick={() => seatReservation(r.id)}
                            >
                              Seat
                            </Button>
                          )}
                          {r.status !== "cancelled" &&
                            r.status !== "completed" &&
                            r.status !== "no_show" && (
                              <Button
                                variant="secondary"
                                size="sm"
                                aria-label="Cancel reservation"
                                loading={actionLoading === r.id}
                                onClick={() => cancelReservation(r.id)}
                              >
                                <XCircle className="h-3.5 w-3.5 text-[var(--color-danger)]" />
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
        </div>
      )}

      {/* ========================== WAITLIST PANEL ========================== */}
      {activeTab === "waitlist" && (
        <div role="tabpanel" aria-label="Waitlist">
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]">
            {waitlistLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--color-text-muted)]" />
              </div>
            ) : waitlist.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="Waitlist is empty"
                description="No guests currently waiting. Add walk-ins to the waitlist."
                action={{ label: "Add to Waitlist", onClick: () => setWaitlistAddOpen(true) }}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell header align="center" className="w-[60px]">
                      #
                    </TableCell>
                    <TableCell header>Guest</TableCell>
                    <TableCell header align="center" className="w-[80px]">
                      Party
                    </TableCell>
                    <TableCell header className="w-[120px]">
                      Quoted Wait
                    </TableCell>
                    <TableCell header className="w-[120px]">
                      Actual Wait
                    </TableCell>
                    <TableCell header className="w-[110px]">
                      Status
                    </TableCell>
                    <TableCell header>Contact</TableCell>
                    <TableCell header align="right" className="w-[280px]">
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {waitlist.map((w) => {
                    const minutesWaiting = getMinutesAgo(w.created_at)
                    const isOverQuoted =
                      w.quoted_wait_minutes !== null && minutesWaiting > w.quoted_wait_minutes
                    return (
                      <TableRow key={w.id}>
                        <TableCell align="center" className="font-[var(--weight-semibold)] tabular-nums">
                          {w.position}
                        </TableCell>
                        <TableCell className="font-[var(--weight-medium)]">
                          {w.customer_name}
                        </TableCell>
                        <TableCell align="center">
                          <span className="inline-flex items-center justify-center gap-[var(--space-1)]">
                            <Users className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                            {w.party_size}
                          </span>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {w.quoted_wait_minutes !== null
                            ? `${w.quoted_wait_minutes} min`
                            : "--"}
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              "tabular-nums font-[var(--weight-medium)] " +
                              (isOverQuoted
                                ? "text-[var(--color-danger)]"
                                : "text-[var(--color-text)]")
                            }
                          >
                            {minutesWaiting} min
                          </span>
                          {isOverQuoted && (
                            <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-[var(--color-danger)]" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={WAITLIST_STATUS_VARIANT[w.status] ?? "default"}>
                            {w.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[var(--color-text-muted)]">
                          {w.customer_phone && (
                            <span className="inline-flex items-center gap-[var(--space-1)]">
                              <Phone className="h-3 w-3" />
                              {w.customer_phone}
                            </span>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <div className="flex items-center justify-end gap-[var(--space-1)]">
                            {w.status === "waiting" && (
                              <Button
                                variant="secondary"
                                size="sm"
                                loading={actionLoading === w.id}
                                leadingIcon={<Bell />}
                                onClick={() => notifyWaitlistEntry(w.id)}
                              >
                                Notify
                              </Button>
                            )}
                            {(w.status === "waiting" || w.status === "notified") && (
                              <Button
                                size="sm"
                                loading={actionLoading === w.id}
                                leadingIcon={<Armchair />}
                                onClick={() => seatWaitlistEntry(w.id)}
                              >
                                Seat
                              </Button>
                            )}
                            {w.status === "waiting" && (
                              <Button
                                variant="secondary"
                                size="sm"
                                aria-label="Cancel"
                                loading={actionLoading === w.id}
                                onClick={() => cancelWaitlistEntry(w.id)}
                              >
                                <X className="h-3.5 w-3.5 text-[var(--color-danger)]" />
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
        </div>
      )}

      {/* ========================== CREATE RESERVATION MODAL ========================== */}
      <Modal open={createOpen} onOpenChange={setCreateOpen}>
        <ModalContent size="md">
          <ModalHeader>
            <ModalTitle>New Reservation</ModalTitle>
            <ModalDescription>Create a reservation for a guest.</ModalDescription>
          </ModalHeader>

          <form onSubmit={handleCreateReservation} className="contents">
            <ModalBody>
              <Text
                label="Guest Name"
                required
                placeholder="Full name"
                value={resForm.customer_name}
                onChange={(e) =>
                  setResForm((f) => ({ ...f, customer_name: e.target.value }))
                }
              />

              <div className="grid grid-cols-2 gap-[var(--space-3)]">
                <Text
                  label="Phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={resForm.customer_phone}
                  onChange={(e) =>
                    setResForm((f) => ({ ...f, customer_phone: e.target.value }))
                  }
                />
                <Email
                  label="Email"
                  placeholder="guest@example.com"
                  value={resForm.customer_email}
                  onChange={(e) =>
                    setResForm((f) => ({ ...f, customer_email: e.target.value }))
                  }
                />
              </div>

              <div className="grid grid-cols-3 gap-[var(--space-3)]">
                <NumberInput
                  label="Party Size"
                  min={1}
                  max={100}
                  value={resForm.party_size}
                  onChange={(e) =>
                    setResForm((f) => ({ ...f, party_size: e.target.value }))
                  }
                />
                <Text
                  label="Date"
                  type="date"
                  value={resForm.reservation_date}
                  onChange={(e) =>
                    setResForm((f) => ({ ...f, reservation_date: e.target.value }))
                  }
                />
                <Text
                  label="Time"
                  type="time"
                  value={resForm.reservation_time}
                  onChange={(e) =>
                    setResForm((f) => ({ ...f, reservation_time: e.target.value }))
                  }
                />
              </div>

              <Textarea
                label="Special Requests"
                rows={2}
                placeholder="Allergies, accessibility needs, celebrations..."
                value={resForm.special_requests}
                onChange={(e) =>
                  setResForm((f) => ({ ...f, special_requests: e.target.value }))
                }
              />

              <Textarea
                label="Internal Notes"
                rows={2}
                placeholder="Staff-only notes..."
                value={resForm.notes}
                onChange={(e) =>
                  setResForm((f) => ({ ...f, notes: e.target.value }))
                }
              />

              {createError && (
                <p className="text-[length:var(--type-footnote-size)] text-[var(--color-danger)]">
                  {createError}
                </p>
              )}
            </ModalBody>

            <ModalFooter>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="md" loading={createLoading}>
                Create Reservation
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* ========================== ADD TO WAITLIST MODAL ========================== */}
      <Modal open={waitlistAddOpen} onOpenChange={setWaitlistAddOpen}>
        <ModalContent size="sm">
          <ModalHeader>
            <ModalTitle>Add to Waitlist</ModalTitle>
            <ModalDescription>Add a walk-in guest to the waitlist.</ModalDescription>
          </ModalHeader>

          <form onSubmit={handleAddToWaitlist} className="contents">
            <ModalBody>
              <Text
                label="Guest Name"
                required
                placeholder="Full name"
                value={waitlistForm.customer_name}
                onChange={(e) =>
                  setWaitlistForm((f) => ({ ...f, customer_name: e.target.value }))
                }
              />

              <Text
                label="Phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={waitlistForm.customer_phone}
                onChange={(e) =>
                  setWaitlistForm((f) => ({ ...f, customer_phone: e.target.value }))
                }
              />

              <div className="grid grid-cols-2 gap-[var(--space-3)]">
                <NumberInput
                  label="Party Size"
                  min={1}
                  max={100}
                  value={waitlistForm.party_size}
                  onChange={(e) =>
                    setWaitlistForm((f) => ({ ...f, party_size: e.target.value }))
                  }
                />
                <NumberInput
                  label="Quoted Wait (min)"
                  min={0}
                  value={waitlistForm.quoted_wait_minutes}
                  onChange={(e) =>
                    setWaitlistForm((f) => ({
                      ...f,
                      quoted_wait_minutes: e.target.value,
                    }))
                  }
                />
              </div>

              <Textarea
                label="Notes"
                rows={2}
                placeholder="Preferences, special needs..."
                value={waitlistForm.notes}
                onChange={(e) =>
                  setWaitlistForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </ModalBody>

            <ModalFooter>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setWaitlistAddOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="md" loading={waitlistAddLoading}>
                Add to Waitlist
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* ========================== RESERVATION DETAIL SHEET ========================== */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent width="lg">
          <SheetHeader>
            <SheetTitle>Reservation Details</SheetTitle>
            <SheetDescription>View and manage this reservation.</SheetDescription>
          </SheetHeader>

          <SheetBody>
            {selectedRes && (
              <div className="space-y-6">
                {/* Guest info */}
                <div className="space-y-[var(--space-3)]">
                  <h3 className="text-[length:var(--type-title-3-size)] font-[var(--weight-semibold)]">
                    {selectedRes.customer_name}
                  </h3>
                  <Badge variant={STATUS_VARIANT[selectedRes.status] ?? "default"}>
                    {selectedRes.status.replace("_", " ")}
                  </Badge>

                  <div className="grid grid-cols-2 gap-[var(--space-4)] pt-[var(--space-2)]">
                    <div className="flex items-center gap-[var(--space-2)] text-[length:var(--type-subhead-size)]">
                      <CalendarDays className="h-4 w-4 text-[var(--color-text-muted)]" />
                      {formatDate(selectedRes.reservation_date)}
                    </div>
                    <div className="flex items-center gap-[var(--space-2)] text-[length:var(--type-subhead-size)]">
                      <Clock className="h-4 w-4 text-[var(--color-text-muted)]" />
                      {formatTime(selectedRes.reservation_time)}
                    </div>
                    <div className="flex items-center gap-[var(--space-2)] text-[length:var(--type-subhead-size)]">
                      <Users className="h-4 w-4 text-[var(--color-text-muted)]" />
                      Party of {selectedRes.party_size}
                    </div>
                    {selectedRes.customer_phone && (
                      <div className="flex items-center gap-[var(--space-2)] text-[length:var(--type-subhead-size)]">
                        <Phone className="h-4 w-4 text-[var(--color-text-muted)]" />
                        {selectedRes.customer_phone}
                      </div>
                    )}
                    {selectedRes.customer_email && (
                      <div className="col-span-2 flex items-center gap-[var(--space-2)] text-[length:var(--type-subhead-size)]">
                        <Mail className="h-4 w-4 text-[var(--color-text-muted)]" />
                        {selectedRes.customer_email}
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-[var(--color-border)]" />

                {/* Special requests */}
                {selectedRes.special_requests && (
                  <>
                    <div>
                      <h4 className="mb-[var(--space-1)] text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[var(--color-text-muted)]">
                        Special Requests
                      </h4>
                      <p className="text-[length:var(--type-subhead-size)]">
                        {selectedRes.special_requests}
                      </p>
                    </div>
                    <div className="border-t border-[var(--color-border)]" />
                  </>
                )}

                {/* Notes */}
                {selectedRes.notes && (
                  <>
                    <div>
                      <h4 className="mb-[var(--space-1)] text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[var(--color-text-muted)]">
                        Internal Notes
                      </h4>
                      <p className="text-[length:var(--type-subhead-size)]">
                        {selectedRes.notes}
                      </p>
                    </div>
                    <div className="border-t border-[var(--color-border)]" />
                  </>
                )}

                {/* Confirmation info */}
                <div className="space-y-[var(--space-2)]">
                  <h4 className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[var(--color-text-muted)]">
                    Notifications
                  </h4>
                  <div className="text-[length:var(--type-subhead-size)]">
                    <div className="flex items-center gap-[var(--space-2)]">
                      <MessageSquare className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                      Confirmation:{" "}
                      {selectedRes.confirmation_sent_at
                        ? new Date(selectedRes.confirmation_sent_at).toLocaleString()
                        : "Not sent"}
                    </div>
                    <div className="mt-[var(--space-1)] flex items-center gap-[var(--space-2)]">
                      <Bell className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                      Reminder:{" "}
                      {selectedRes.reminder_sent_at
                        ? new Date(selectedRes.reminder_sent_at).toLocaleString()
                        : "Not sent"}
                    </div>
                  </div>
                </div>

                <div className="border-t border-[var(--color-border)]" />

                {/* Available time slots for this date */}
                <div>
                  <h4 className="mb-[var(--space-2)] text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[var(--color-text-muted)]">
                    Available Slots ({formatDate(selectedRes.reservation_date)})
                  </h4>
                  {slotsLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[var(--color-text-muted)]" />
                  ) : availableSlots.length === 0 ? (
                    <p className="text-[length:var(--type-subhead-size)] text-[var(--color-text-muted)]">
                      No available slots
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-[var(--space-2)]">
                      {availableSlots.map((slot) => (
                        <Badge
                          key={slot.time}
                          variant={
                            slot.time === selectedRes.reservation_time ? "primary" : "default"
                          }
                          className="tabular-nums"
                        >
                          {formatTime(slot.time)} ({slot.available_tables})
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-[var(--color-border)]" />

                {/* Actions */}
                <div className="flex flex-wrap gap-[var(--space-2)] pb-8">
                  {selectedRes.status === "pending" && (
                    <Button
                      variant="secondary"
                      size="lg"
                      className="flex-1"
                      loading={actionLoading === selectedRes.id}
                      leadingIcon={<CheckCircle2 />}
                      onClick={() => confirmReservation(selectedRes.id)}
                    >
                      Confirm
                    </Button>
                  )}
                  {(selectedRes.status === "pending" ||
                    selectedRes.status === "confirmed") && (
                    <Button
                      size="lg"
                      className="flex-1"
                      loading={actionLoading === selectedRes.id}
                      leadingIcon={<Armchair />}
                      onClick={() => seatReservation(selectedRes.id)}
                    >
                      Seat Guest
                    </Button>
                  )}
                  {selectedRes.status !== "cancelled" &&
                    selectedRes.status !== "completed" &&
                    selectedRes.status !== "no_show" && (
                      <Button
                        variant="secondary"
                        size="lg"
                        loading={actionLoading === selectedRes.id}
                        leadingIcon={<XCircle className="text-[var(--color-danger)]" />}
                        onClick={() => cancelReservation(selectedRes.id)}
                      >
                        Cancel
                      </Button>
                    )}
                </div>
              </div>
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </div>
  )
}

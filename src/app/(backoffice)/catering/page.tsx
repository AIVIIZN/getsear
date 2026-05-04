"use client"

import * as React from "react"
import { CateringCalendar } from "@/components/catering/CateringCalendar"
import {
  CalendarDays,
  Plus,
  Search,
  Trash2,
  Eye,
  Users,
  DollarSign,
  UtensilsCrossed,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui-v2/Button"
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
} from "@/components/ui-v2/Card"
import { Text } from "@/components/ui-v2/inputs/Text"
import { NumberInput } from "@/components/ui-v2/inputs/Number"
import { Select } from "@/components/ui-v2/inputs/Select"
import { Textarea } from "@/components/ui-v2/inputs/Textarea"
import { Badge } from "@/components/ui-v2/data/Badge"
import { Skeleton } from "@/components/ui-v2/data/Skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui-v2/data/Table"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
} from "@/components/ui-v2/Sheet"
import { ConfirmDialog } from "@/components/ui-v2/feedback/ConfirmDialog"
import { EmptyState } from "@/components/ui-v2/feedback/EmptyState"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CateringEvent {
  id: string
  org_id: string
  location_id: string
  customer_id: string | null
  event_name: string
  event_date: string
  event_time: string
  guest_count: number
  status: string
  total: string | null
  deposit: string | null
  notes: string | null
  contact_name: string
  contact_phone: string | null
  contact_email: string | null
  delivery_address: Record<string, unknown> | null
  created_at: string
}

interface CateringMenu {
  id: string
  org_id: string
  name: string
  description: string | null
  min_guests: number | null
  per_person_price: string
  items: Array<Record<string, unknown>>
  is_active: boolean
  created_at: string
}

interface CalendarEvent {
  id: string
  event_name: string
  event_date: string
  event_time: string
  guest_count: number
  status: string
  contact_name: string
  total: string | null
}

// ---------------------------------------------------------------------------
// Status variant mapping (token-based)
// ---------------------------------------------------------------------------
function eventStatusVariant(
  status: string,
): "default" | "primary" | "warning" | "success" | "danger" {
  switch (status) {
    case "inquiry":
      return "default"
    case "quoted":
      return "primary"
    case "confirmed":
      return "success"
    case "in_progress":
      return "warning"
    case "completed":
      return "primary"
    case "cancelled":
      return "danger"
    default:
      return "default"
  }
}

// Token-based pastel chip backgrounds for calendar cells.
const CALENDAR_CHIP_CLS: Record<string, string> = {
  inquiry: "bg-[var(--color-bg-muted)] text-[var(--color-text)]",
  quoted: "bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] text-[var(--color-primary)]",
  confirmed: "bg-[var(--color-success-bg)] text-[var(--color-success)]",
  in_progress: "bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
  completed: "bg-[color-mix(in_srgb,var(--color-primary)_18%,transparent)] text-[var(--color-primary)]",
  cancelled: "bg-[var(--color-danger-bg)] text-[var(--color-danger)]",
}

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "inquiry", label: "Inquiry" },
  { value: "quoted", label: "Quoted" },
  { value: "confirmed", label: "Confirmed" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
]

const STATUS_FORM_OPTIONS = [
  { value: "inquiry", label: "Inquiry" },
  { value: "quoted", label: "Quoted" },
  { value: "confirmed", label: "Confirmed" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
]

// ---------------------------------------------------------------------------
// Calendar helpers
// ---------------------------------------------------------------------------
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function CateringPage() {
  const [tab, setTab] = React.useState("events")

  // Events state
  const [events, setEvents] = React.useState<CateringEvent[]>([])
  const [calendarEvents, setCalendarEvents] = React.useState<CalendarEvent[]>([])
  const [eventsLoading, setEventsLoading] = React.useState(true)
  const [eventSearch, setEventSearch] = React.useState("")
  const [eventStatusFilter, setEventStatusFilter] = React.useState("all")
  const [eventSheetOpen, setEventSheetOpen] = React.useState(false)
  const [editingEvent, setEditingEvent] = React.useState<CateringEvent | null>(null)
  const [saving, setSaving] = React.useState(false)

  // Calendar month
  const [calMonth, setCalMonth] = React.useState(new Date().getMonth())
  const [calYear, setCalYear] = React.useState(new Date().getFullYear())

  // Event form
  const [evName, setEvName] = React.useState("")
  const [evDate, setEvDate] = React.useState("")
  const [evTime, setEvTime] = React.useState("")
  const [evGuests, setEvGuests] = React.useState("")
  const [evStatus, setEvStatus] = React.useState("inquiry")
  const [evTotal, setEvTotal] = React.useState("")
  const [evDeposit, setEvDeposit] = React.useState("")
  const [evNotes, setEvNotes] = React.useState("")
  const [evContact, setEvContact] = React.useState("")
  const [evPhone, setEvPhone] = React.useState("")
  const [evEmail, setEvEmail] = React.useState("")

  // Menus state
  const [menus, setMenus] = React.useState<CateringMenu[]>([])
  const [menusLoading, setMenusLoading] = React.useState(true)
  const [menuSheetOpen, setMenuSheetOpen] = React.useState(false)
  const [editingMenu, setEditingMenu] = React.useState<CateringMenu | null>(null)
  const [menuName, setMenuName] = React.useState("")
  const [menuDesc, setMenuDesc] = React.useState("")
  const [menuMinGuests, setMenuMinGuests] = React.useState("")
  const [menuPrice, setMenuPrice] = React.useState("")

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [menuToDelete, setMenuToDelete] = React.useState<CateringMenu | null>(null)

  // -----------------------------------------------------------------------
  // Fetch events
  // -----------------------------------------------------------------------
  const fetchEvents = React.useCallback(async () => {
    setEventsLoading(true)
    try {
      const params = new URLSearchParams()
      if (eventStatusFilter && eventStatusFilter !== "all")
        params.set("status", eventStatusFilter)
      const res = await fetch(`/api/catering/events?${params}`)
      if (res.ok) {
        const json = await res.json()
        setEvents(json.data ?? [])
      }
    } finally {
      setEventsLoading(false)
    }
  }, [eventStatusFilter])

  const fetchCalendar = React.useCallback(async () => {
    const start = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-01`
    const daysInMonth = getDaysInMonth(calYear, calMonth)
    const end = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`
    const res = await fetch(`/api/catering/calendar?start=${start}&end=${end}`)
    if (res.ok) {
      const json = await res.json()
      setCalendarEvents(json.data ?? [])
    }
  }, [calYear, calMonth])

  const fetchMenus = React.useCallback(async () => {
    setMenusLoading(true)
    try {
      const res = await fetch("/api/catering/menus")
      if (res.ok) {
        const json = await res.json()
        setMenus(json.data ?? [])
      }
    } finally {
      setMenusLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  React.useEffect(() => {
    if (tab === "events") fetchCalendar()
  }, [tab, fetchCalendar])

  React.useEffect(() => {
    if (tab === "menus") fetchMenus()
  }, [tab, fetchMenus])

  // -----------------------------------------------------------------------
  // Event CRUD
  // -----------------------------------------------------------------------
  function openCreateEvent() {
    setEditingEvent(null)
    setEvName("")
    setEvDate("")
    setEvTime("")
    setEvGuests("")
    setEvStatus("inquiry")
    setEvTotal("")
    setEvDeposit("")
    setEvNotes("")
    setEvContact("")
    setEvPhone("")
    setEvEmail("")
    setEventSheetOpen(true)
  }

  function openEditEvent(ev: CateringEvent) {
    setEditingEvent(ev)
    setEvName(ev.event_name)
    setEvDate(ev.event_date)
    setEvTime(ev.event_time)
    setEvGuests(String(ev.guest_count))
    setEvStatus(ev.status)
    setEvTotal(ev.total ?? "")
    setEvDeposit(ev.deposit ?? "")
    setEvNotes(ev.notes ?? "")
    setEvContact(ev.contact_name)
    setEvPhone(ev.contact_phone ?? "")
    setEvEmail(ev.contact_email ?? "")
    setEventSheetOpen(true)
  }

  async function handleSaveEvent() {
    setSaving(true)
    try {
      const payload = {
        event_name: evName,
        event_date: evDate,
        event_time: evTime,
        guest_count: parseInt(evGuests, 10) || 1,
        status: evStatus,
        total: evTotal || null,
        deposit: evDeposit || null,
        notes: evNotes || null,
        contact_name: evContact,
        contact_phone: evPhone || null,
        contact_email: evEmail || null,
        location_id: "00000000-0000-0000-0000-000000000000", // placeholder
      }

      const url = editingEvent
        ? `/api/catering/events/${editingEvent.id}`
        : "/api/catering/events"

      const res = await fetch(url, {
        method: editingEvent ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        setEventSheetOpen(false)
        fetchEvents()
        fetchCalendar()
      }
    } finally {
      setSaving(false)
    }
  }

  // -----------------------------------------------------------------------
  // Menu CRUD
  // -----------------------------------------------------------------------
  function openCreateMenu() {
    setEditingMenu(null)
    setMenuName("")
    setMenuDesc("")
    setMenuMinGuests("")
    setMenuPrice("")
    setMenuSheetOpen(true)
  }

  function openEditMenu(m: CateringMenu) {
    setEditingMenu(m)
    setMenuName(m.name)
    setMenuDesc(m.description ?? "")
    setMenuMinGuests(m.min_guests ? String(m.min_guests) : "")
    setMenuPrice(m.per_person_price)
    setMenuSheetOpen(true)
  }

  async function handleSaveMenu() {
    setSaving(true)
    try {
      const payload = {
        name: menuName,
        description: menuDesc || null,
        min_guests: menuMinGuests ? parseInt(menuMinGuests, 10) : null,
        per_person_price: menuPrice,
      }

      const url = editingMenu
        ? `/api/catering/menus/${editingMenu.id}`
        : "/api/catering/menus"

      const res = await fetch(url, {
        method: editingMenu ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        setMenuSheetOpen(false)
        fetchMenus()
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteMenu() {
    if (!menuToDelete) return
    const res = await fetch(`/api/catering/menus/${menuToDelete.id}`, {
      method: "DELETE",
    })
    if (res.ok) {
      setMenuToDelete(null)
      fetchMenus()
    }
  }

  // -----------------------------------------------------------------------
  // Filtered events
  // -----------------------------------------------------------------------
  const filteredEvents = events.filter(
    (e) =>
      e.event_name.toLowerCase().includes(eventSearch.toLowerCase()) ||
      e.contact_name.toLowerCase().includes(eventSearch.toLowerCase()),
  )

  // -----------------------------------------------------------------------
  // Calendar grid
  // -----------------------------------------------------------------------
  const daysInMonth = getDaysInMonth(calYear, calMonth)
  const firstDay = getFirstDayOfWeek(calYear, calMonth)
  const calendarDays: Array<{ day: number; events: CalendarEvent[] }> = []
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    calendarDays.push({
      day: d,
      events: calendarEvents.filter((ev) => ev.event_date === dateStr),
    })
  }

  function prevMonth() {
    if (calMonth === 0) {
      setCalMonth(11)
      setCalYear(calYear - 1)
    } else {
      setCalMonth(calMonth - 1)
    }
  }

  function nextMonth() {
    if (calMonth === 11) {
      setCalMonth(0)
      setCalYear(calYear + 1)
    } else {
      setCalMonth(calMonth + 1)
    }
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Catering</h1>
          <p className="page-subtitle">
            Events, menus, and catering management
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => v && setTab(v)}>
        <TabsList>
          <TabsTrigger value="calendar">
            <CalendarDays className="mr-2 h-4 w-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="events">
            <CalendarDays className="mr-2 h-4 w-4" />
            Events
          </TabsTrigger>
          <TabsTrigger value="menus">
            <UtensilsCrossed className="mr-2 h-4 w-4" />
            Menus
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="space-y-4">
          <CateringCalendar />
        </TabsContent>

        {/* ============================================================
            EVENTS TAB
            ============================================================ */}
        <TabsContent value="events" className="space-y-6">
          {/* Calendar */}
          <Card padding="default">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {MONTH_NAMES[calMonth]} {calYear}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label="Previous month"
                    onClick={prevMonth}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label="Next month"
                    onClick={nextMonth}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-7 gap-px bg-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div
                    key={d}
                    className="bg-[var(--color-bg-subtle)] px-[var(--space-2)] py-[var(--space-2)] text-center text-[length:var(--type-caption-1-size)] font-[var(--weight-medium)] text-[var(--color-text-muted)]"
                  >
                    {d}
                  </div>
                ))}
                {/* Blank cells for start of month offset */}
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div
                    key={`blank-${i}`}
                    className="bg-[var(--color-surface)] min-h-[72px]"
                  />
                ))}
                {calendarDays.map(({ day, events: dayEvents }) => (
                  <button
                    key={day}
                    type="button"
                    className="btn-press text-left bg-[var(--color-surface)] min-h-[72px] p-[var(--space-2)] text-[length:var(--type-subhead-size)] hover:bg-[var(--color-surface-hover)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] focus-visible:outline-offset-[-2px]"
                    onClick={() => {
                      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                      setEvDate(dateStr)
                      openCreateEvent()
                    }}
                    aria-label={`Add event for day ${day}`}
                  >
                    <span className="text-[length:var(--type-caption-1-size)] font-[var(--weight-medium)] text-[var(--color-text)]">
                      {day}
                    </span>
                    {dayEvents.map((ev) => {
                      const cls =
                        CALENDAR_CHIP_CLS[ev.status] ??
                        "bg-[var(--color-bg-muted)] text-[var(--color-text)]"
                      return (
                        <div
                          key={ev.id}
                          className={`mt-[2px] rounded-[var(--radius-xs)] px-[var(--space-1)] py-[2px] text-[10px] truncate ${cls}`}
                          title={`${ev.event_name} (${ev.guest_count} guests)`}
                        >
                          {ev.event_name}
                        </div>
                      )
                    })}
                  </button>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Events list */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="max-w-sm w-[260px]">
                <Text
                  placeholder="Search events..."
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                  leadingIcon={<Search className="h-4 w-4" />}
                  aria-label="Search events"
                />
              </div>
              <div className="w-[160px]">
                <Select
                  options={STATUS_FILTER_OPTIONS}
                  value={eventStatusFilter}
                  onChange={(v) => setEventStatusFilter(v)}
                  ariaLabel="Filter by status"
                />
              </div>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={openCreateEvent}
              leadingIcon={<Plus className="h-4 w-4" />}
            >
              New Event
            </Button>
          </div>

          {eventsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} variant="table-row" />
              ))}
            </div>
          ) : filteredEvents.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No catering events"
              description="Create your first catering event to get started."
              action={{ label: "New Event", onClick: openCreateEvent }}
            />
          ) : (
            <Card padding="compact" className="!p-0 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell header>Event</TableCell>
                    <TableCell header>Date</TableCell>
                    <TableCell header>Contact</TableCell>
                    <TableCell header align="right">
                      Guests
                    </TableCell>
                    <TableCell header>Status</TableCell>
                    <TableCell header align="right">
                      Total
                    </TableCell>
                    <TableCell header className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map((ev) => (
                    <TableRow key={ev.id}>
                      <TableCell className="font-[var(--weight-medium)]">
                        {ev.event_name}
                      </TableCell>
                      <TableCell>
                        {new Date(
                          ev.event_date + "T00:00:00",
                        ).toLocaleDateString()}
                        <span className="ml-1 text-[var(--color-text-muted)]">
                          {ev.event_time}
                        </span>
                      </TableCell>
                      <TableCell>{ev.contact_name}</TableCell>
                      <TableCell align="right" className="tabular-nums">
                        {ev.guest_count}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={eventStatusVariant(ev.status)}
                          className="capitalize"
                        >
                          {ev.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell align="right" className="tabular-nums">
                        {ev.total
                          ? `$${parseFloat(ev.total).toFixed(2)}`
                          : "--"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`View ${ev.event_name}`}
                          onClick={() => openEditEvent(ev)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* ============================================================
            MENUS TAB
            ============================================================ */}
        <TabsContent value="menus" className="space-y-4">
          <div className="flex items-center justify-end">
            <Button
              variant="primary"
              size="md"
              onClick={openCreateMenu}
              leadingIcon={<Plus className="h-4 w-4" />}
            >
              New Menu Package
            </Button>
          </div>

          {menusLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} variant="card" />
              ))}
            </div>
          ) : menus.length === 0 ? (
            <EmptyState
              icon={UtensilsCrossed}
              title="No catering menus"
              description="Create catering menu packages for your events."
              action={{
                label: "New Menu Package",
                onClick: openCreateMenu,
              }}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {menus.map((m) => (
                <Card key={m.id} padding="default" className="relative">
                  {!m.is_active && (
                    <Badge
                      variant="default"
                      className="absolute top-[var(--space-3)] right-[var(--space-3)]"
                    >
                      Inactive
                    </Badge>
                  )}
                  <CardHeader>
                    <CardTitle>{m.name}</CardTitle>
                  </CardHeader>
                  <CardBody>
                    {m.description && (
                      <p className="text-[length:var(--type-subhead-size)] text-[var(--color-text-muted)] line-clamp-2">
                        {m.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-[length:var(--type-subhead-size)]">
                      <span className="flex items-center gap-1 text-[var(--color-text-muted)]">
                        <DollarSign className="h-3.5 w-3.5" />
                        {parseFloat(m.per_person_price).toFixed(2)}/person
                      </span>
                      {m.min_guests && (
                        <span className="flex items-center gap-1 text-[var(--color-text-muted)]">
                          <Users className="h-3.5 w-3.5" />
                          Min {m.min_guests}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 border-t border-[var(--color-border)] pt-[var(--space-3)]">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openEditMenu(m)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Deactivate ${m.name}`}
                        onClick={() => {
                          setMenuToDelete(m)
                          setDeleteDialogOpen(true)
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-[var(--color-danger)]" />
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ================================================================
          EVENT SHEET
          ================================================================ */}
      <Sheet open={eventSheetOpen} onOpenChange={setEventSheetOpen}>
        <SheetContent width="lg">
          <SheetHeader>
            <SheetTitle>
              {editingEvent ? "Edit Event" : "New Catering Event"}
            </SheetTitle>
            <SheetDescription>
              {editingEvent
                ? "Update event details."
                : "Create a new catering event or inquiry."}
            </SheetDescription>
          </SheetHeader>

          <SheetBody className="space-y-4">
            <Text
              label="Event Name"
              value={evName}
              onChange={(e) => setEvName(e.target.value)}
              placeholder="e.g. Johnson Wedding Reception"
            />
            <div className="grid grid-cols-2 gap-4">
              <Text
                label="Date"
                type="date"
                value={evDate}
                onChange={(e) => setEvDate(e.target.value)}
              />
              <Text
                label="Time"
                type="time"
                value={evTime}
                onChange={(e) => setEvTime(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <NumberInput
                label="Guest Count"
                value={evGuests}
                onChange={(e) => setEvGuests(e.target.value)}
                placeholder="50"
              />
              <Select
                label="Status"
                options={STATUS_FORM_OPTIONS}
                value={evStatus}
                onChange={(v) => setEvStatus(v)}
              />
            </div>
            <div className="border-t border-[var(--color-border)] pt-[var(--space-4)]">
              <Text
                label="Contact Name"
                value={evContact}
                onChange={(e) => setEvContact(e.target.value)}
                placeholder="Jane Smith"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Text
                label="Phone"
                value={evPhone}
                onChange={(e) => setEvPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
              <Text
                label="Email"
                type="email"
                value={evEmail}
                onChange={(e) => setEvEmail(e.target.value)}
                placeholder="jane@example.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-[var(--color-border)] pt-[var(--space-4)]">
              <NumberInput
                label="Total ($)"
                step="0.01"
                value={evTotal}
                onChange={(e) => setEvTotal(e.target.value)}
                placeholder="0.00"
              />
              <NumberInput
                label="Deposit ($)"
                step="0.01"
                value={evDeposit}
                onChange={(e) => setEvDeposit(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <Textarea
              label="Notes"
              value={evNotes}
              onChange={(e) => setEvNotes(e.target.value)}
              rows={3}
              placeholder="Special instructions, dietary needs..."
            />
          </SheetBody>
          <SheetFooter>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setEventSheetOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSaveEvent}
              disabled={!evName || !evContact}
              loading={saving}
            >
              {editingEvent ? "Update" : "Create"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ================================================================
          MENU SHEET
          ================================================================ */}
      <Sheet open={menuSheetOpen} onOpenChange={setMenuSheetOpen}>
        <SheetContent width="lg">
          <SheetHeader>
            <SheetTitle>
              {editingMenu ? "Edit Menu Package" : "New Menu Package"}
            </SheetTitle>
            <SheetDescription>
              Create per-person catering menu packages.
            </SheetDescription>
          </SheetHeader>

          <SheetBody className="space-y-4">
            <Text
              label="Package Name"
              value={menuName}
              onChange={(e) => setMenuName(e.target.value)}
              placeholder="e.g. Corporate Lunch"
            />
            <Textarea
              label="Description"
              value={menuDesc}
              onChange={(e) => setMenuDesc(e.target.value)}
              rows={3}
              placeholder="What's included..."
            />
            <div className="grid grid-cols-2 gap-4">
              <NumberInput
                label="Per-Person Price ($)"
                step="0.01"
                value={menuPrice}
                onChange={(e) => setMenuPrice(e.target.value)}
                placeholder="18.00"
              />
              <NumberInput
                label="Min Guests"
                value={menuMinGuests}
                onChange={(e) => setMenuMinGuests(e.target.value)}
                placeholder="10"
              />
            </div>
          </SheetBody>
          <SheetFooter>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setMenuSheetOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSaveMenu}
              disabled={!menuName || !menuPrice}
              loading={saving}
            >
              {editingMenu ? "Update" : "Create"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ================================================================
          DELETE MENU CONFIRM
          ================================================================ */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(o) => {
          setDeleteDialogOpen(o)
          if (!o) setMenuToDelete(null)
        }}
        title="Deactivate Menu"
        description={`Are you sure you want to deactivate "${menuToDelete?.name ?? ""}"? It will no longer appear in active listings.`}
        confirmLabel="Deactivate"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleDeleteMenu}
      />
    </div>
  )
}

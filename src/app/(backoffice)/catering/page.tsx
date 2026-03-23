"use client"

import * as React from "react"
import { CateringCalendar } from "@/components/catering/CateringCalendar"
import {
  CalendarDays,
  Plus,
  Search,
  Loader2,
  Trash2,
  Eye,
  Users,
  DollarSign,
  UtensilsCrossed,
  X,
  ChevronLeft,
  ChevronRight,
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
// Status colors
// ---------------------------------------------------------------------------
const EVENT_STATUS_COLORS: Record<string, string> = {
  inquiry: "bg-gray-100 text-gray-700 border-gray-200",
  quoted: "bg-blue-50 text-blue-700 border-blue-200",
  confirmed: "bg-green-50 text-green-700 border-green-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  completed: "bg-purple-50 text-purple-700 border-purple-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
}

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
  const [eventStatusFilter, setEventStatusFilter] = React.useState("")
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
      if (eventStatusFilter) params.set("status", eventStatusFilter)
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
    setSaving(true)
    try {
      const res = await fetch(`/api/catering/menus/${menuToDelete.id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setDeleteDialogOpen(false)
        setMenuToDelete(null)
        fetchMenus()
      }
    } finally {
      setSaving(false)
    }
  }

  // -----------------------------------------------------------------------
  // Filtered events
  // -----------------------------------------------------------------------
  const filteredEvents = events.filter((e) =>
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
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {MONTH_NAMES[calMonth]} {calYear}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextMonth}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div
                    key={d}
                    className="bg-muted px-2 py-1.5 text-center text-xs font-medium text-muted-foreground"
                  >
                    {d}
                  </div>
                ))}
                {/* Blank cells for start of month offset */}
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`blank-${i}`} className="bg-card min-h-[72px]" />
                ))}
                {calendarDays.map(({ day, events: dayEvents }) => (
                  <div
                    key={day}
                    className="bg-card min-h-[72px] p-1.5 text-sm hover:bg-accent/30 transition-colors cursor-pointer"
                    onClick={() => {
                      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                      setEvDate(dateStr)
                      openCreateEvent()
                    }}
                  >
                    <span className="text-xs font-medium">{day}</span>
                    {dayEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className={`mt-0.5 rounded px-1 py-0.5 text-[10px] truncate ${EVENT_STATUS_COLORS[ev.status] ?? "bg-gray-100"}`}
                        title={`${ev.event_name} (${ev.guest_count} guests)`}
                      >
                        {ev.event_name}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Events list */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search events..."
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={eventStatusFilter} onValueChange={(v) => v && setEventStatusFilter(v)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="inquiry">Inquiry</SelectItem>
                  <SelectItem value="quoted">Quoted</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={openCreateEvent} className="btn-press">
              <Plus className="mr-2 h-4 w-4" />
              New Event
            </Button>
          </div>

          {eventsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredEvents.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No catering events"
              description="Create your first catering event to get started."
              actionLabel="New Event"
              onAction={openCreateEvent}
            />
          ) : (
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-right">Guests</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map((ev) => (
                    <TableRow key={ev.id}>
                      <TableCell className="font-medium">{ev.event_name}</TableCell>
                      <TableCell className="text-sm">
                        {new Date(ev.event_date + "T00:00:00").toLocaleDateString()}
                        <span className="ml-1 text-muted-foreground">{ev.event_time}</span>
                      </TableCell>
                      <TableCell>{ev.contact_name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {ev.guest_count}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`capitalize text-xs ${EVENT_STATUS_COLORS[ev.status] ?? ""}`}
                        >
                          {ev.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {ev.total ? `$${parseFloat(ev.total).toFixed(2)}` : "--"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditEvent(ev)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ============================================================
            MENUS TAB
            ============================================================ */}
        <TabsContent value="menus" className="space-y-4">
          <div className="flex items-center justify-end">
            <Button onClick={openCreateMenu} className="btn-press">
              <Plus className="mr-2 h-4 w-4" />
              New Menu Package
            </Button>
          </div>

          {menusLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : menus.length === 0 ? (
            <EmptyState
              icon={UtensilsCrossed}
              title="No catering menus"
              description="Create catering menu packages for your events."
              actionLabel="New Menu Package"
              onAction={openCreateMenu}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {menus.map((m) => (
                <Card key={m.id} className="relative">
                  {!m.is_active && (
                    <Badge
                      variant="outline"
                      className="absolute top-3 right-3 bg-gray-100 text-gray-500 text-xs"
                    >
                      Inactive
                    </Badge>
                  )}
                  <CardHeader>
                    <CardTitle className="text-base">{m.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {m.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {m.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <DollarSign className="h-3.5 w-3.5" />
                        {parseFloat(m.per_person_price).toFixed(2)}/person
                      </span>
                      {m.min_guests && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          Min {m.min_guests}
                        </span>
                      )}
                    </div>
                    <Separator />
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditMenu(m)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => {
                          setMenuToDelete(m)
                          setDeleteDialogOpen(true)
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
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
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
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

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>Event Name</Label>
              <Input value={evName} onChange={(e) => setEvName(e.target.value)} placeholder="e.g. Johnson Wedding Reception" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={evDate} onChange={(e) => setEvDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Time</Label>
                <Input type="time" value={evTime} onChange={(e) => setEvTime(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Guest Count</Label>
                <Input type="number" value={evGuests} onChange={(e) => setEvGuests(e.target.value)} placeholder="50" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={evStatus} onValueChange={(v) => v && setEvStatus(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inquiry">Inquiry</SelectItem>
                    <SelectItem value="quoted">Quoted</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Contact Name</Label>
              <Input value={evContact} onChange={(e) => setEvContact(e.target.value)} placeholder="Jane Smith" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={evPhone} onChange={(e) => setEvPhone(e.target.value)} placeholder="(555) 123-4567" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={evEmail} onChange={(e) => setEvEmail(e.target.value)} placeholder="jane@example.com" />
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Total ($)</Label>
                <Input type="number" step="0.01" value={evTotal} onChange={(e) => setEvTotal(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Deposit ($)</Label>
                <Input type="number" step="0.01" value={evDeposit} onChange={(e) => setEvDeposit(e.target.value)} placeholder="0.00" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={evNotes} onChange={(e) => setEvNotes(e.target.value)} rows={3} placeholder="Special instructions, dietary needs..." />
            </div>
            <Separator />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEventSheetOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveEvent} disabled={saving || !evName || !evContact} className="btn-press">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingEvent ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ================================================================
          MENU SHEET
          ================================================================ */}
      <Sheet open={menuSheetOpen} onOpenChange={setMenuSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editingMenu ? "Edit Menu Package" : "New Menu Package"}
            </SheetTitle>
            <SheetDescription>
              Create per-person catering menu packages.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>Package Name</Label>
              <Input value={menuName} onChange={(e) => setMenuName(e.target.value)} placeholder="e.g. Corporate Lunch" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={menuDesc} onChange={(e) => setMenuDesc(e.target.value)} rows={3} placeholder="What's included..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Per-Person Price ($)</Label>
                <Input type="number" step="0.01" value={menuPrice} onChange={(e) => setMenuPrice(e.target.value)} placeholder="18.00" />
              </div>
              <div className="space-y-2">
                <Label>Min Guests</Label>
                <Input type="number" value={menuMinGuests} onChange={(e) => setMenuMinGuests(e.target.value)} placeholder="10" />
              </div>
            </div>
            <Separator />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMenuSheetOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveMenu} disabled={saving || !menuName || !menuPrice} className="btn-press">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingMenu ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ================================================================
          DELETE MENU DIALOG
          ================================================================ */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Menu</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate &ldquo;{menuToDelete?.name}&rdquo;?
              It will no longer appear in active listings.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteMenu} disabled={saving} className="btn-press">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

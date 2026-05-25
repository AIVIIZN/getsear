"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  AlertTriangle,
  CalendarDays,
  Clock3,
  Mail,
  NotebookTabs,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  UserRound,
} from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Badge } from "@/components/ui-v2/data/Badge"
import { Skeleton } from "@/components/ui-v2/data/Skeleton"
import { EmptyState } from "@/components/ui-v2/feedback/EmptyState"
import { Button } from "@/components/ui-v2/Button"
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, ModalTitle } from "@/components/ui-v2/Modal"
import { Text } from "@/components/ui-v2/inputs/Text"
import { Textarea } from "@/components/ui-v2/inputs/Textarea"
import { cn } from "@/lib/utils"

type Guest = {
  id: string
  display_name: string
  first_name?: string | null
  last_name?: string | null
  birthday?: string | null
  lifecycle_stage: string
  is_vip: boolean
  total_visits?: number | null
  total_spend?: string | number | null
  last_visit_at?: string | null
  guest_contact_points?: ContactPoint[]
  guest_preferences?: Preference[]
  guest_allergies?: Allergy[]
  guest_tags?: GuestTag[]
  notes?: Note[]
}

type ContactPoint = { id: string; contact_type: string; value: string; is_primary?: boolean }
type Preference = { id: string; preference_category: string; preference_key: string; preference_value?: Record<string, unknown> }
type Allergy = { id: string; allergen: string; severity: string; reaction_notes?: string | null }
type GuestTag = { id: string; crm_tags?: { name: string; slug: string; tag_category: string; is_sensitive?: boolean } | null }
type Note = { id: string; note_category: string; body: string; visibility: string }
type TimelineEvent = { id: string; event_at: string; event_type: string; title: string; body?: string | null; visibility: string }
type OrderRecord = { id: string; order_number: string; status: string; order_type: string; total: string; item_count: number; created_at: string; closed_at: string | null }
type UserProfile = { role: string }

const createGuestSchema = z.object({
  display_name: z.string().trim().min(1, "Name is required").max(240),
  email: z.string().trim().email("Use a valid email").optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
})

type CreateGuestInput = z.infer<typeof createGuestSchema>
type TabId = "overview" | "orders" | "visits" | "reservations" | "loyalty" | "campaigns" | "feedback" | "notes" | "ai" | "household" | "consent"

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "orders", label: "Orders" },
  { id: "visits", label: "Visits" },
  { id: "reservations", label: "Reservations" },
  { id: "loyalty", label: "Loyalty" },
  { id: "campaigns", label: "Campaigns" },
  { id: "feedback", label: "Feedback" },
  { id: "notes", label: "Notes" },
  { id: "ai", label: "AI Insights" },
  { id: "household", label: "Household" },
  { id: "consent", label: "Data & Consent" },
]

const ownerRoles = new Set(["platform_admin", "owner", "admin", "analyst", "marketing"])

function formatCurrency(value: string | number | null | undefined) {
  const amount = typeof value === "string" ? Number(value) : value ?? 0
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number.isFinite(amount) ? amount : 0)
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded"
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function primaryContact(guest: Guest, type: string) {
  return guest.guest_contact_points?.find((contact) => contact.contact_type === type && contact.is_primary)?.value
    ?? guest.guest_contact_points?.find((contact) => contact.contact_type === type)?.value
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const json = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(json.error ?? "Request failed")
  return json as T
}

export default function GuestsPage() {
  const [query, setQuery] = React.useState("")
  const [guests, setGuests] = React.useState<Guest[]>([])
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [selectedGuest, setSelectedGuest] = React.useState<Guest | null>(null)
  const [timeline, setTimeline] = React.useState<TimelineEvent[]>([])
  const [orders, setOrders] = React.useState<OrderRecord[]>([])
  const [activeTab, setActiveTab] = React.useState<TabId>("overview")
  const [listState, setListState] = React.useState<"loading" | "ready" | "error">("loading")
  const [detailState, setDetailState] = React.useState<"idle" | "loading" | "ready" | "error">("idle")
  const [profile, setProfile] = React.useState<UserProfile | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)
  const [noteDraft, setNoteDraft] = React.useState("")
  const [savingNote, setSavingNote] = React.useState(false)
  const createForm = useForm<CreateGuestInput>({ resolver: zodResolver(createGuestSchema), defaultValues: { display_name: "", email: "", phone: "" } })
  const isOwnerMode = profile ? ownerRoles.has(profile.role) : false

  const loadGuests = React.useCallback(async (search: string) => {
    setListState("loading")
    try {
      const params = new URLSearchParams({ limit: "25", sort_by: "last_visit_at", sort_dir: "desc" })
      if (search.trim()) params.set("search", search.trim())
      const json = await fetchJson<{ data: Guest[] }>(`/api/crm/guests?${params}`)
      setGuests(json.data)
      setSelectedId((current) => current ?? json.data[0]?.id ?? null)
      setListState("ready")
    } catch {
      setListState("error")
    }
  }, [])

  React.useEffect(() => {
    fetchJson<{ user: UserProfile }>("/api/auth/me").then((json) => setProfile(json.user)).catch(() => setProfile(null))
    loadGuests("")
  }, [loadGuests])

  React.useEffect(() => {
    if (!selectedId) {
      setSelectedGuest(null)
      setTimeline([])
      setOrders([])
      return
    }
    setDetailState("loading")
    Promise.all([
      fetchJson<{ data: Guest }>(`/api/crm/guests/${selectedId}`),
      fetchJson<{ data: TimelineEvent[] }>(`/api/crm/guests/${selectedId}/timeline?limit=25`),
      fetchJson<{ data: OrderRecord[] }>(`/api/crm/guests/${selectedId}/orders?limit=10`),
    ]).then(([guestJson, timelineJson, ordersJson]) => {
      setSelectedGuest(guestJson.data)
      setTimeline(timelineJson.data)
      setOrders(ordersJson.data)
      setDetailState("ready")
    }).catch(() => setDetailState("error"))
  }, [selectedId])

  async function createGuest(input: CreateGuestInput) {
    setCreateError(null)
    const contact_points: Array<{ contact_type: "email" | "phone"; label: string; value: string; is_primary: boolean; source: string }> = [
      input.email ? { contact_type: "email", label: "Email", value: input.email, is_primary: true, source: "guest_360" } : null,
      input.phone ? { contact_type: "phone", label: "Phone", value: input.phone, is_primary: !input.email, source: "guest_360" } : null,
    ].filter((contact): contact is { contact_type: "email" | "phone"; label: string; value: string; is_primary: boolean; source: string } => Boolean(contact))
    try {
      const json = await fetchJson<{ data: Guest }>("/api/crm/guests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: input.display_name, contact_points }),
      })
      setCreateOpen(false)
      createForm.reset()
      await loadGuests("")
      setSelectedId(json.data.id)
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Guest could not be created")
    }
  }

  async function addNote() {
    if (!selectedGuest || !noteDraft.trim()) return
    setSavingNote(true)
    try {
      await fetchJson(`/api/crm/guests/${selectedGuest.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteDraft.trim(), note_category: "hospitality", visibility: "service", source: "guest_360" }),
      })
      setNoteDraft("")
      setSelectedId(selectedGuest.id)
      const json = await fetchJson<{ data: Guest }>(`/api/crm/guests/${selectedGuest.id}`)
      setSelectedGuest(json.data)
    } finally {
      setSavingNote(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-var(--topbar-height)-var(--space-12))] min-h-[680px] flex-col gap-[var(--space-4)]">
      <header className="flex flex-wrap items-start justify-between gap-[var(--space-4)]">
        <div>
          <p className="text-[length:var(--type-caption-1-size)] font-[var(--weight-semibold)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-text-muted)]">GuestBrain CRM</p>
          <h1 className="text-[length:var(--type-title-1-size)] font-[var(--weight-semibold)] leading-[var(--type-line-height-tight)] text-[var(--color-text)]">Guests</h1>
        </div>
        <Button size="md" leadingIcon={<Plus />} onClick={() => setCreateOpen(true)}>New guest</Button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)] gap-[var(--space-4)] xl:grid-cols-[320px_minmax(0,1fr)_280px]">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="border-b border-[var(--color-border)] p-[var(--space-3)]">
            <Text value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && loadGuests(query)} placeholder="Name, email, phone, tag" leadingIcon={<Search className="h-4 w-4" />} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-[var(--space-2)]">
            {listState === "loading" ? <GuestListSkeleton /> : null}
            {listState === "error" ? <InlineState icon={AlertTriangle} title="Guest list unavailable" body="Refresh or narrow the search." /> : null}
            {listState === "ready" && guests.length === 0 ? (
              <EmptyState illustration="no-customers" title="No guests yet" description="Create the first GuestBrain profile when a diner gives a name, phone, or email." action={{ label: "Create guest", onClick: () => setCreateOpen(true) }} />
            ) : null}
            {guests.map((guest) => (
              <button key={guest.id} type="button" onClick={() => setSelectedId(guest.id)} className={cn("mb-[var(--space-2)] flex w-full flex-col gap-[var(--space-2)] rounded-[var(--radius-sm)] border p-[var(--space-3)] text-left transition-colors", selectedId === guest.id ? "border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)]" : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)]")}>
                <span className="flex items-center justify-between gap-[var(--space-2)]">
                  <span className="truncate text-[length:var(--type-callout-size)] font-[var(--weight-semibold)] text-[var(--color-text)]">{guest.display_name}</span>
                  {guest.is_vip ? <Star className="h-4 w-4 text-[var(--color-warning)]" /> : null}
                </span>
                <span className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">{guest.lifecycle_stage.replaceAll("_", " ")} - {guest.total_visits ?? 0} visits</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="min-h-0 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]">
          {detailState === "loading" ? <ProfileSkeleton /> : null}
          {detailState === "error" ? <InlineState icon={AlertTriangle} title="Guest profile unavailable" body="The profile may have been archived or your role may not have access." /> : null}
          {detailState === "ready" && selectedGuest ? (
            <div className="flex h-full min-h-0 flex-col">
              <ProfileHeader guest={selectedGuest} isOwnerMode={isOwnerMode} />
              <nav className="flex gap-[var(--space-2)] overflow-x-auto border-b border-[var(--color-border)] px-[var(--space-4)] py-[var(--space-2)]">
                {tabs.map((tab) => (
                  <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={cn("min-h-[40px] rounded-[var(--radius-sm)] px-[var(--space-3)] text-[length:var(--type-footnote-size)] font-[var(--weight-medium)] transition-colors", activeTab === tab.id ? "bg-[var(--color-primary)] text-[var(--color-text-on-primary)]" : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]")}>{tab.label}</button>
                ))}
              </nav>
              <section className="min-h-0 flex-1 overflow-y-auto p-[var(--space-4)]">
                <TabContent tab={activeTab} guest={selectedGuest} timeline={timeline} orders={orders} isOwnerMode={isOwnerMode} noteDraft={noteDraft} setNoteDraft={setNoteDraft} savingNote={savingNote} addNote={addNote} />
              </section>
            </div>
          ) : null}
        </main>

        <aside className="hidden min-h-0 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] xl:block">
          <div className="border-b border-[var(--color-border)] p-[var(--space-4)]">
            <h2 className="text-[length:var(--type-callout-size)] font-[var(--weight-semibold)] text-[var(--color-text)]">Service scan</h2>
            <p className="mt-[var(--space-1)] text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">Identity, hospitality warnings, timeline.</p>
          </div>
          {selectedGuest ? <ServiceScan guest={selectedGuest} timeline={timeline} /> : <InlineState icon={UserRound} title="Select a guest" body="Service guidance appears after a profile loads." />}
        </aside>
      </div>

      <Modal open={createOpen} onOpenChange={setCreateOpen}>
        <ModalContent>
          <ModalHeader><ModalTitle>Create guest</ModalTitle></ModalHeader>
          <form onSubmit={createForm.handleSubmit(createGuest)}>
            <ModalBody className="space-y-[var(--space-4)]">
              <Text label="Name" error={createForm.formState.errors.display_name?.message} {...createForm.register("display_name")} />
              <Text label="Email" error={createForm.formState.errors.email?.message} {...createForm.register("email")} />
              <Text label="Phone" error={createForm.formState.errors.phone?.message} {...createForm.register("phone")} />
              {createError ? <p className="text-[length:var(--type-footnote-size)] text-[var(--color-danger)]">{createError}</p> : null}
            </ModalBody>
            <ModalFooter>
              <Button variant="secondary" size="md" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" size="md" loading={createForm.formState.isSubmitting}>Create</Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </div>
  )
}

function ProfileHeader({ guest, isOwnerMode }: { guest: Guest; isOwnerMode: boolean }) {
  const email = primaryContact(guest, "email")
  const phone = primaryContact(guest, "phone")
  return (
    <div className="border-b border-[var(--color-border)] p-[var(--space-4)]">
      <div className="flex flex-wrap items-start justify-between gap-[var(--space-4)]">
        <div>
          <div className="flex flex-wrap items-center gap-[var(--space-2)]">
            <h2 className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[var(--color-text)]">{guest.display_name}</h2>
            {guest.is_vip ? <Badge variant="warning">VIP</Badge> : null}
            <Badge variant="info">{guest.lifecycle_stage.replaceAll("_", " ")}</Badge>
          </div>
          <div className="mt-[var(--space-2)] flex flex-wrap gap-[var(--space-3)] text-[length:var(--type-footnote-size)] text-[var(--color-text-muted)]">
            <span className="inline-flex items-center gap-[var(--space-1)]"><Mail className="h-4 w-4" />{email ?? "No email"}</span>
            <span className="inline-flex items-center gap-[var(--space-1)]"><Phone className="h-4 w-4" />{phone ?? "No phone"}</span>
            <span className="inline-flex items-center gap-[var(--space-1)]"><CalendarDays className="h-4 w-4" />Last visit {formatDate(guest.last_visit_at)}</span>
          </div>
        </div>
        {isOwnerMode ? <div className="grid grid-cols-2 gap-[var(--space-2)] text-right"><Metric label="Spend" value={formatCurrency(guest.total_spend)} /><Metric label="Visits" value={String(guest.total_visits ?? 0)} /></div> : null}
      </div>
    </div>
  )
}

function TabContent(props: { tab: TabId; guest: Guest; timeline: TimelineEvent[]; orders: OrderRecord[]; isOwnerMode: boolean; noteDraft: string; setNoteDraft: (value: string) => void; savingNote: boolean; addNote: () => void }) {
  const { tab, guest, timeline, orders, isOwnerMode } = props
  if (tab === "overview") return <Overview guest={guest} timeline={timeline} isOwnerMode={isOwnerMode} />
  if (tab === "orders") return <Orders orders={orders} />
  if (tab === "visits") return <Timeline events={timeline.filter((event) => event.event_type.includes("visit") || event.event_type.includes("order"))} emptyTitle="No visit timeline yet" />
  if (tab === "notes") return <Notes guest={guest} noteDraft={props.noteDraft} setNoteDraft={props.setNoteDraft} savingNote={props.savingNote} addNote={props.addNote} />
  if (tab === "consent") return <DataConsent guest={guest} />
  return <InlineState icon={NotebookTabs} title={`${tabs.find((item) => item.id === tab)?.label} has no records yet`} body="This tab will populate from linked restaurant activity as the guest profile accumulates data." />
}

function Overview({ guest, timeline, isOwnerMode }: { guest: Guest; timeline: TimelineEvent[]; isOwnerMode: boolean }) {
  return (
    <div className="grid gap-[var(--space-4)] lg:grid-cols-2">
      <Panel title="Hospitality warnings"><Warnings guest={guest} /></Panel>
      <Panel title="Preferences">{guest.guest_preferences?.length ? guest.guest_preferences.map((pref) => <Row key={pref.id} title={pref.preference_key} body={pref.preference_category} />) : <InlineState icon={Sparkles} title="No preferences recorded" body="Preferences appear after server notes or POS-linked history." />}</Panel>
      {isOwnerMode ? <Panel title="Guest value"><Metric label="Lifetime spend" value={formatCurrency(guest.total_spend)} /><Metric label="Total visits" value={String(guest.total_visits ?? 0)} /></Panel> : null}
      <Panel title="Timeline"><Timeline events={timeline.slice(0, 6)} emptyTitle="No timeline events yet" /></Panel>
    </div>
  )
}

function Orders({ orders }: { orders: OrderRecord[] }) {
  if (!orders.length) return <InlineState icon={Clock3} title="No linked order history" body="Orders appear here once POS checks are linked through the legacy customer bridge or guest attachment." />
  return <div className="divide-y divide-[var(--color-border)]">{orders.map((order) => <Row key={order.id} title={`#${order.order_number} - ${formatCurrency(order.total)}`} body={`${order.order_type} - ${order.status} - ${order.item_count} items - ${formatDate(order.closed_at ?? order.created_at)}`} />)}</div>
}

function Notes({ guest, noteDraft, setNoteDraft, savingNote, addNote }: { guest: Guest; noteDraft: string; setNoteDraft: (value: string) => void; savingNote: boolean; addNote: () => void }) {
  return <div className="space-y-[var(--space-4)]"><Textarea label="Hospitality note" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Add a service-safe note for the next visit" /><Button size="md" disabled={!noteDraft.trim()} loading={savingNote} onClick={addNote}>Add note</Button><div className="divide-y divide-[var(--color-border)]">{guest.notes?.length ? guest.notes.map((note) => <Row key={note.id} title={note.note_category} body={note.body} />) : <InlineState icon={NotebookTabs} title="No visible notes" body="Manager and owner-only notes stay hidden from staff roles." />}</div></div>
}

function DataConsent({ guest }: { guest: Guest }) {
  return <Panel title="Profile data"><Row title="Birthday" body={formatDate(guest.birthday)} /><Row title="Contacts" body={`${guest.guest_contact_points?.length ?? 0} contact points`} /><Row title="Tags" body={`${guest.guest_tags?.length ?? 0} assigned tags`} /></Panel>
}

function Warnings({ guest }: { guest: Guest }) {
  const allergies = guest.guest_allergies ?? []
  if (!allergies.length) return <InlineState icon={ShieldCheck} title="No active allergy warnings" body="Service-critical allergies will pin here." />
  return <div className="space-y-[var(--space-2)]">{allergies.map((allergy) => <Row key={allergy.id} title={allergy.allergen} body={`${allergy.severity}${allergy.reaction_notes ? ` - ${allergy.reaction_notes}` : ""}`} />)}</div>
}

function ServiceScan({ guest, timeline }: { guest: Guest; timeline: TimelineEvent[] }) {
  return <div className="space-y-[var(--space-3)] p-[var(--space-4)]"><Warnings guest={guest} /><div className="border-t border-[var(--color-border)] pt-[var(--space-3)]"><Timeline events={timeline.slice(0, 4)} emptyTitle="No service activity yet" /></div></div>
}

function Timeline({ events, emptyTitle }: { events: TimelineEvent[]; emptyTitle: string }) {
  if (!events.length) return <InlineState icon={Clock3} title={emptyTitle} body="Profile events appear as CRM and POS workflows touch this guest." />
  return <div className="space-y-[var(--space-3)]">{events.map((event) => <Row key={event.id} title={event.title} body={`${formatDate(event.event_at)} - ${event.body ?? event.event_type}`} />)}</div>
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-[var(--space-4)]"><h3 className="mb-[var(--space-3)] text-[length:var(--type-callout-size)] font-[var(--weight-semibold)] text-[var(--color-text)]">{title}</h3>{children}</section>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">{label}</p><p className="text-[length:var(--type-title-3-size)] font-[var(--weight-semibold)] text-[var(--color-text)]">{value}</p></div>
}

function Row({ title, body }: { title: string; body?: string | null }) {
  return <div className="py-[var(--space-3)]"><p className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[var(--color-text)]">{title}</p>{body ? <p className="mt-[var(--space-1)] text-[length:var(--type-footnote-size)] text-[var(--color-text-muted)]">{body}</p> : null}</div>
}

function InlineState({ icon: Icon, title, body }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }) {
  return <div className="flex min-h-[160px] flex-col items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-bg-subtle)] p-[var(--space-6)] text-center"><Icon className="mb-[var(--space-3)] h-8 w-8 text-[var(--color-text-muted)]" /><p className="text-[length:var(--type-callout-size)] font-[var(--weight-semibold)] text-[var(--color-text)]">{title}</p><p className="mt-[var(--space-1)] max-w-sm text-[length:var(--type-footnote-size)] text-[var(--color-text-muted)]">{body}</p></div>
}

function GuestListSkeleton() {
  return <div className="space-y-[var(--space-2)]">{Array.from({ length: 7 }).map((_, index) => <Skeleton key={index} variant="card" className="h-[92px]" />)}</div>
}

function ProfileSkeleton() {
  return <div className="space-y-[var(--space-4)] p-[var(--space-4)]"><Skeleton variant="text" lines={3} /><Skeleton variant="chart" /><Skeleton variant="table-row" /><Skeleton variant="table-row" /></div>
}

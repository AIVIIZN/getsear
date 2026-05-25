"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  AlertTriangle,
  CalendarDays,
  Clock3,
  GitMerge,
  Mail,
  NotebookTabs,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Upload,
  UserRound,
  UsersRound,
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
  guest_consents?: GuestConsent[]
  suppression_entries?: SuppressionEntry[]
  privacy_requests?: PrivacyRequest[]
  guest_tags?: GuestTag[]
  notes?: Note[]
  crm_permissions?: CrmGuestPermissions
}

type ContactPoint = { id: string; contact_type: string; value: string; is_primary?: boolean }
type Preference = { id: string; preference_category: string; preference_key: string; preference_value?: Record<string, unknown> }
type Allergy = { id: string; allergen: string; severity: string; reaction_notes?: string | null }
type ConsentChannel = "email" | "sms" | "push" | "in_app" | "phone" | "mail"
type ConsentPurpose = "marketing" | "transactional" | "loyalty" | "reservation" | "feedback" | "personalization"
type ConsentStatus = "granted" | "revoked" | "unknown"
type GuestConsent = {
  id: string
  channel: ConsentChannel
  purpose: ConsentPurpose
  status: ConsentStatus
  source: string
  proof?: Record<string, unknown> | null
  captured_at: string
  revoked_at?: string | null
  consent_policy_versions?: { version_label: string; language: string; effective_at: string } | null
}
type SuppressionEntry = { id: string; channel: ConsentChannel; purpose: ConsentPurpose | "all"; reason: string; source: string; suppressed_at: string; proof?: Record<string, unknown> | null }
type PrivacyRequestType = "export" | "delete" | "correct" | "do_not_contact" | "opt_out_sale_sharing" | "limit_sensitive_use"
type PrivacyRequestStatus = "submitted" | "needs_verification" | "approved" | "in_progress" | "completed" | "rejected" | "cancelled"
type PrivacyRequest = {
  id: string
  request_type: PrivacyRequestType
  status: PrivacyRequestStatus
  priority: "normal" | "urgent"
  requested_by_name: string
  requested_by_contact: string
  details?: string | null
  due_at?: string | null
  approved_at?: string | null
  completed_at?: string | null
  decision_note?: string | null
  data_export_jobs?: Array<{ id: string; status: string; generated_at?: string | null; export_payload?: Record<string, unknown> }>
  data_deletion_jobs?: Array<{ id: string; status: string; completed_at?: string | null; anonymization_report?: Record<string, unknown> }>
  data_access_logs?: Array<{ id: string; access_type: string; created_at: string; reason?: string | null }>
}
type GuestTag = { id: string; crm_tags?: { name: string; slug: string; tag_category: string; is_sensitive?: boolean } | null }
type Note = { id: string; note_category: string; body: string; visibility: string }
type TimelineEvent = { id: string; event_at: string; event_type: string; title: string; body?: string | null; visibility: string }
type OrderRecord = { id: string; order_number: string; status: string; order_type: string; total: string | number | null; item_count: number; created_at: string; closed_at: string | null }
type CrmGuestPermissions = {
  can_view_hospitality_notes: boolean
  can_view_recovery_details: boolean
  can_view_revenue_attribution: boolean
  can_view_do_not_contact_reason: boolean
  can_view_internal_manager_notes: boolean
  can_manage_consent: boolean
  can_manage_privacy_requests: boolean
  can_export_guest_data: boolean
}
type UserProfile = { role: string; crm_permissions?: CrmGuestPermissions }
type IdentityCandidate = {
  id: string
  primary_guest_id: string
  candidate_guest_id: string
  confidence: number
  confidence_level: string
  signals: string[]
  evidence?: { items?: Array<{ signal: string; label: string; detail: string; weight: number }> }
  primary_guest?: CandidateGuest | null
  candidate_guest?: CandidateGuest | null
}
type CandidateGuest = { id: string; display_name: string; lifecycle_stage: string; total_visits?: number | null; total_spend?: string | number | null }
type ImportValidationRow = { row_number: number; validation_status: "valid" | "invalid" | "duplicate"; errors: string[]; warnings: string[]; normalized_data: Record<string, unknown> }
type ImportPreview = { summary: { original_row_count: number; valid_row_count: number; invalid_row_count: number; duplicate_row_count: number; suspicious_row_count: number }; rows: ImportValidationRow[] }

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

function formatCurrency(value: string | number | null | undefined) {
  const amount = typeof value === "string" ? Number(value) : value ?? 0
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number.isFinite(amount) ? amount : 0)
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded"
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not recorded"
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
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
  const [identityCandidates, setIdentityCandidates] = React.useState<IdentityCandidate[]>([])
  const [activeTab, setActiveTab] = React.useState<TabId>("overview")
  const [listState, setListState] = React.useState<"loading" | "ready" | "error">("loading")
  const [detailState, setDetailState] = React.useState<"idle" | "loading" | "ready" | "error">("idle")
  const [identityState, setIdentityState] = React.useState<"idle" | "loading" | "ready" | "error">("idle")
  const [identityBusyId, setIdentityBusyId] = React.useState<string | null>(null)
  const [identityError, setIdentityError] = React.useState<string | null>(null)
  const [profile, setProfile] = React.useState<UserProfile | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)
  const [importOpen, setImportOpen] = React.useState(false)
  const [importCsv, setImportCsv] = React.useState("name,email,phone,birthday,consent,source\nAvery Stone,avery@example.com,512-555-0199,1990-04-12,yes,spreadsheet opt-in")
  const [importPreview, setImportPreview] = React.useState<ImportPreview | null>(null)
  const [importBusy, setImportBusy] = React.useState<"idle" | "validating" | "importing">("idle")
  const [importError, setImportError] = React.useState<string | null>(null)
  const [noteDraft, setNoteDraft] = React.useState("")
  const [savingNote, setSavingNote] = React.useState(false)
  const createForm = useForm<CreateGuestInput>({ resolver: zodResolver(createGuestSchema), defaultValues: { display_name: "", email: "", phone: "" } })
  const canViewRevenue = Boolean(profile?.crm_permissions?.can_view_revenue_attribution)

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
      setIdentityCandidates([])
      return
    }
    setDetailState("loading")
    setIdentityState("loading")
    Promise.allSettled([
      fetchJson<{ data: Guest }>(`/api/crm/guests/${selectedId}`),
      fetchJson<{ data: TimelineEvent[] }>(`/api/crm/guests/${selectedId}/timeline?limit=25`),
      fetchJson<{ data: OrderRecord[] }>(`/api/crm/guests/${selectedId}/orders?limit=10`),
      fetchJson<{ data: IdentityCandidate[] }>(`/api/crm/identity/candidates?guest_id=${selectedId}&limit=8`),
    ]).then(([guestResult, timelineResult, ordersResult, identityResult]) => {
      if (guestResult.status !== "fulfilled") {
        setDetailState("error")
        setIdentityState("error")
        return
      }
      setSelectedGuest(guestResult.value.data)
      setTimeline(timelineResult.status === "fulfilled" ? timelineResult.value.data : [])
      setOrders(ordersResult.status === "fulfilled" ? ordersResult.value.data : [])
      setIdentityCandidates(identityResult.status === "fulfilled" ? identityResult.value.data : [])
      setDetailState("ready")
      setIdentityState(identityResult.status === "fulfilled" ? "ready" : "error")
    })
  }, [selectedId])

  async function resolveIdentity(candidate: IdentityCandidate, action: "merge" | "dismiss" | "keep_separate" | "mark_household") {
    if (!selectedGuest) return
    setIdentityBusyId(candidate.id)
    setIdentityError(null)
    const primaryId = candidate.primary_guest_id === selectedGuest.id ? candidate.primary_guest_id : selectedGuest.id
    const secondaryId = candidate.primary_guest_id === selectedGuest.id ? candidate.candidate_guest_id : candidate.primary_guest_id
    const url = action === "merge"
      ? "/api/crm/identity/merge"
      : action === "mark_household"
        ? "/api/crm/identity/household"
        : "/api/crm/identity/dismiss"
    const body = action === "merge"
      ? { candidate_id: candidate.id, primary_guest_id: primaryId, secondary_guest_id: secondaryId, reason: "Reviewed in Guest 360 identity resolution" }
      : action === "mark_household"
        ? { candidate_id: candidate.id, primary_guest_id: primaryId, secondary_guest_id: secondaryId, reason: "Reviewed in Guest 360 identity resolution" }
        : { candidate_id: candidate.id, decision_type: action, reason: "Reviewed in Guest 360 identity resolution" }
    try {
      await fetchJson(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const json = await fetchJson<{ data: IdentityCandidate[] }>(`/api/crm/identity/candidates?guest_id=${selectedGuest.id}&generate=false&limit=8`)
      setIdentityCandidates(json.data)
      const guestJson = await fetchJson<{ data: Guest }>(`/api/crm/guests/${selectedGuest.id}`)
      setSelectedGuest(guestJson.data)
    } catch (error) {
      setIdentityError(error instanceof Error ? error.message : "Identity decision failed")
    } finally {
      setIdentityBusyId(null)
    }
  }

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

  function parseImportCsv() {
    const lines = importCsv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    if (lines.length < 2) throw new Error("Add a header row and at least one guest row.")
    const headers = lines[0].split(",").map((header) => header.trim())
    return lines.slice(1).map((line) => {
      const cells = line.split(",").map((cell) => cell.trim())
      return headers.reduce<Record<string, string>>((row, header, index) => {
        row[header] = cells[index] ?? ""
        return row
      }, {})
    })
  }

  async function submitImport(commit: boolean) {
    setImportBusy(commit ? "importing" : "validating")
    setImportError(null)
    try {
      const json = await fetchJson<{ data: ImportPreview }>("/api/crm/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_type: "spreadsheet",
          file_name: "guest-import.csv",
          mapping: { display_name: "name", email: "email", phone: "phone", birthday: "birthday", consent_status: "consent", consent_source: "source" },
          rows: parseImportCsv(),
          commit,
        }),
      })
      setImportPreview(json.data)
      if (commit) {
        await loadGuests(query)
      }
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Import failed")
    } finally {
      setImportBusy("idle")
    }
  }

  return (
    <div className="flex h-[calc(100vh-var(--topbar-height)-var(--space-12))] min-h-[680px] flex-col gap-[var(--space-4)]">
      <header className="flex flex-wrap items-start justify-between gap-[var(--space-4)]">
        <div>
          <p className="text-[length:var(--type-caption-1-size)] font-[var(--weight-semibold)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-text-muted)]">GuestBrain CRM</p>
          <h1 className="text-[length:var(--type-title-1-size)] font-[var(--weight-semibold)] leading-[var(--type-line-height-tight)] text-[var(--color-text)]">Guests</h1>
        </div>
        <div className="flex flex-wrap gap-[var(--space-2)]">
          <Button variant="secondary" size="md" leadingIcon={<Upload />} onClick={() => setImportOpen(true)}>Import</Button>
          <Button size="md" leadingIcon={<Plus />} onClick={() => setCreateOpen(true)}>New guest</Button>
        </div>
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
              <ProfileHeader guest={selectedGuest} canViewRevenue={canViewRevenue} />
              <nav className="flex gap-[var(--space-2)] overflow-x-auto border-b border-[var(--color-border)] px-[var(--space-4)] py-[var(--space-2)]">
                {tabs.map((tab) => (
                  <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={cn("min-h-[40px] rounded-[var(--radius-sm)] px-[var(--space-3)] text-[length:var(--type-footnote-size)] font-[var(--weight-medium)] transition-colors", activeTab === tab.id ? "bg-[var(--color-primary)] text-[var(--color-text-on-primary)]" : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]")}>{tab.label}</button>
                ))}
              </nav>
              <section className="min-h-0 flex-1 overflow-y-auto p-[var(--space-4)]">
                <TabContent tab={activeTab} guest={selectedGuest} timeline={timeline} orders={orders} canViewRevenue={canViewRevenue} noteDraft={noteDraft} setNoteDraft={setNoteDraft} savingNote={savingNote} addNote={addNote} identityCandidates={identityCandidates} identityState={identityState} identityBusyId={identityBusyId} identityError={identityError} resolveIdentity={resolveIdentity} />
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

      <Modal open={importOpen} onOpenChange={setImportOpen}>
        <ModalContent className="max-w-[760px]">
          <ModalHeader><ModalTitle>Import guests</ModalTitle></ModalHeader>
          <ModalBody className="space-y-[var(--space-4)]">
            <Textarea label="CSV rows" value={importCsv} onChange={(event) => setImportCsv(event.target.value)} rows={7} />
            {importPreview ? (
              <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)]">
                <div className="grid grid-cols-5 gap-[var(--space-2)] border-b border-[var(--color-border)] p-[var(--space-3)] text-center">
                  <Metric label="Rows" value={String(importPreview.summary.original_row_count)} />
                  <Metric label="Valid" value={String(importPreview.summary.valid_row_count)} />
                  <Metric label="Invalid" value={String(importPreview.summary.invalid_row_count)} />
                  <Metric label="Duplicates" value={String(importPreview.summary.duplicate_row_count)} />
                  <Metric label="Warnings" value={String(importPreview.summary.suspicious_row_count)} />
                </div>
                <div className="max-h-[240px] overflow-y-auto p-[var(--space-3)]">
                  {importPreview.rows.slice(0, 8).map((row) => (
                    <div key={row.row_number} className="mb-[var(--space-2)] flex items-start justify-between gap-[var(--space-3)] rounded-[var(--radius-sm)] bg-[var(--color-surface-muted)] p-[var(--space-3)]">
                      <div>
                        <p className="text-[length:var(--type-footnote-size)] font-[var(--weight-semibold)] text-[var(--color-text)]">Row {row.row_number} - {String(row.normalized_data.display_name ?? "Unnamed guest")}</p>
                        <p className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">{[...row.errors, ...row.warnings].join(", ") || "Ready to import"}</p>
                      </div>
                      <Badge variant={row.validation_status === "valid" ? "success" : row.validation_status === "duplicate" ? "warning" : "danger"}>{row.validation_status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {importError ? <p className="text-[length:var(--type-footnote-size)] text-[var(--color-danger)]">{importError}</p> : null}
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" size="md" onClick={() => setImportOpen(false)}>Close</Button>
            <Button variant="secondary" size="md" loading={importBusy === "validating"} onClick={() => submitImport(false)}>Validate</Button>
            <Button size="md" loading={importBusy === "importing"} disabled={!importPreview || importPreview.summary.valid_row_count === 0} onClick={() => submitImport(true)}>Import valid rows</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}

function ProfileHeader({ guest, canViewRevenue }: { guest: Guest; canViewRevenue: boolean }) {
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
        {canViewRevenue ? <div className="grid grid-cols-2 gap-[var(--space-2)] text-right"><Metric label="Spend" value={formatCurrency(guest.total_spend)} /><Metric label="Visits" value={String(guest.total_visits ?? 0)} /></div> : null}
      </div>
    </div>
  )
}

function TabContent(props: { tab: TabId; guest: Guest; timeline: TimelineEvent[]; orders: OrderRecord[]; canViewRevenue: boolean; noteDraft: string; setNoteDraft: (value: string) => void; savingNote: boolean; addNote: () => void; identityCandidates: IdentityCandidate[]; identityState: "idle" | "loading" | "ready" | "error"; identityBusyId: string | null; identityError: string | null; resolveIdentity: (candidate: IdentityCandidate, action: "merge" | "dismiss" | "keep_separate" | "mark_household") => Promise<void> }) {
  const { tab, guest, timeline, orders, canViewRevenue } = props
  if (tab === "overview") return <Overview guest={guest} timeline={timeline} canViewRevenue={canViewRevenue} />
  if (tab === "orders") return <Orders orders={orders} />
  if (tab === "visits") return <Timeline events={timeline.filter((event) => event.event_type.includes("visit") || event.event_type.includes("order"))} emptyTitle="No visit timeline yet" />
  if (tab === "notes") return <Notes guest={guest} noteDraft={props.noteDraft} setNoteDraft={props.setNoteDraft} savingNote={props.savingNote} addNote={props.addNote} />
  if (tab === "household") return <IdentityResolution candidates={props.identityCandidates} state={props.identityState} busyId={props.identityBusyId} error={props.identityError} resolveIdentity={props.resolveIdentity} />
  if (tab === "consent") return <DataConsent guest={guest} />
  return <InlineState icon={NotebookTabs} title={`${tabs.find((item) => item.id === tab)?.label} has no records yet`} body="This tab will populate from linked restaurant activity as the guest profile accumulates data." />
}

function IdentityResolution({ candidates, state, busyId, error, resolveIdentity }: { candidates: IdentityCandidate[]; state: "idle" | "loading" | "ready" | "error"; busyId: string | null; error: string | null; resolveIdentity: (candidate: IdentityCandidate, action: "merge" | "dismiss" | "keep_separate" | "mark_household") => Promise<void> }) {
  if (state === "loading") return <div className="space-y-[var(--space-3)]"><Skeleton variant="card" className="h-[148px]" /><Skeleton variant="card" className="h-[148px]" /></div>
  if (state === "error") return <InlineState icon={AlertTriangle} title="Identity review unavailable" body="Duplicate evidence could not be loaded for this guest." />
  if (!candidates.length) return <InlineState icon={UsersRound} title="No duplicate candidates" body="Verified contact, loyalty, account, payment, reservation, and name-plus-contact signals are clean for this profile." />

  return (
    <div className="space-y-[var(--space-3)]">
      {error ? <p className="rounded-[var(--radius-sm)] bg-[var(--color-danger-bg)] p-[var(--space-3)] text-[length:var(--type-footnote-size)] text-[var(--color-danger)]">{error}</p> : null}
      {candidates.map((candidate) => {
        const otherGuest = candidate.candidate_guest ?? candidate.primary_guest
        const weak = candidate.confidence < 75
        return (
          <section key={candidate.id} className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-[var(--space-4)]">
            <div className="flex flex-wrap items-start justify-between gap-[var(--space-3)]">
              <div>
                <div className="flex flex-wrap items-center gap-[var(--space-2)]">
                  <GitMerge className="h-4 w-4 text-[var(--color-text-muted)]" />
                  <h3 className="text-[length:var(--type-callout-size)] font-[var(--weight-semibold)] text-[var(--color-text)]">{otherGuest?.display_name ?? "Guest candidate"}</h3>
                  <Badge variant={weak ? "warning" : "info"}>{candidate.confidence}% match</Badge>
                </div>
                <p className="mt-[var(--space-1)] text-[length:var(--type-footnote-size)] text-[var(--color-text-muted)]">{weak ? "Suggestion only - weak matches never auto-merge." : "Review evidence before changing either profile."}</p>
              </div>
              <div className="flex flex-wrap gap-[var(--space-2)]">
                <Button size="sm" disabled={weak || busyId === candidate.id} loading={busyId === candidate.id} onClick={() => resolveIdentity(candidate, "merge")}>Merge</Button>
                <Button size="sm" variant="secondary" disabled={busyId === candidate.id} onClick={() => resolveIdentity(candidate, "mark_household")}>Household</Button>
                <Button size="sm" variant="secondary" disabled={busyId === candidate.id} onClick={() => resolveIdentity(candidate, "keep_separate")}>Separate</Button>
                <Button size="sm" variant="ghost" disabled={busyId === candidate.id} onClick={() => resolveIdentity(candidate, "dismiss")}>Dismiss</Button>
              </div>
            </div>
            <div className="mt-[var(--space-3)] divide-y divide-[var(--color-border)]">
              {(candidate.evidence?.items ?? []).map((item) => <Row key={`${candidate.id}-${item.signal}-${item.detail}`} title={item.label} body={`${item.detail} Weight ${item.weight}`} />)}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function Overview({ guest, timeline, canViewRevenue }: { guest: Guest; timeline: TimelineEvent[]; canViewRevenue: boolean }) {
  return (
    <div className="grid gap-[var(--space-4)] lg:grid-cols-2">
      <Panel title="Hospitality warnings"><Warnings guest={guest} /></Panel>
      <Panel title="Preferences">{guest.guest_preferences?.length ? guest.guest_preferences.map((pref) => <Row key={pref.id} title={pref.preference_key} body={pref.preference_category} />) : <InlineState icon={Sparkles} title="No preferences recorded" body="Preferences appear after server notes or POS-linked history." />}</Panel>
      {canViewRevenue ? <Panel title="Guest value"><Metric label="Lifetime spend" value={formatCurrency(guest.total_spend)} /><Metric label="Total visits" value={String(guest.total_visits ?? 0)} /></Panel> : null}
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

const consentMatrix: Array<{ channel: ConsentChannel; purpose: ConsentPurpose; label: string; help: string }> = [
  { channel: "email", purpose: "marketing", label: "Email marketing", help: "Campaigns, promotions, and winback offers." },
  { channel: "sms", purpose: "marketing", label: "SMS marketing", help: "Text campaigns and limited-time offers." },
  { channel: "email", purpose: "transactional", label: "Email receipts", help: "Receipts and service messages tied to an order." },
  { channel: "sms", purpose: "transactional", label: "Text receipts", help: "SMS receipts and order-status messages." },
  { channel: "email", purpose: "loyalty", label: "Loyalty email", help: "Rewards enrollment and points updates." },
  { channel: "sms", purpose: "loyalty", label: "Loyalty SMS", help: "Rewards updates by text." },
  { channel: "email", purpose: "reservation", label: "Reservation email", help: "Reservation reminders and changes." },
  { channel: "sms", purpose: "feedback", label: "Feedback SMS", help: "Post-visit feedback requests." },
]

function consentKey(channel: ConsentChannel, purpose: ConsentPurpose) {
  return `${channel}:${purpose}`
}

function consentTone(status: ConsentStatus): "success" | "warning" | "default" {
  if (status === "granted") return "success"
  if (status === "revoked") return "warning"
  return "default"
}

function proofSummary(proof: Record<string, unknown> | null | undefined) {
  if (!proof) return "No proof captured"
  const surface = typeof proof.ui_surface === "string" ? proof.ui_surface : typeof proof.captured_via === "string" ? proof.captured_via : "Consent center"
  const version = typeof proof.language_version === "string" ? proof.language_version : typeof proof.policy_key === "string" ? proof.policy_key : "current language"
  return `${surface} - ${version}`
}

function DataConsent({ guest }: { guest: Guest }) {
  const permissions = guest.crm_permissions
  const canManageConsent = Boolean(permissions?.can_manage_consent)
  const canManagePrivacyRequests = Boolean(permissions?.can_manage_privacy_requests)
  const primaryContact = guest.guest_contact_points?.find((contact) => contact.is_primary)
  const guestPrimaryContact = primaryContact?.value ?? guest.guest_contact_points?.[0]?.value ?? ""
  const [consents, setConsents] = React.useState<GuestConsent[]>(guest.guest_consents ?? [])
  const [suppressions, setSuppressions] = React.useState<SuppressionEntry[]>(guest.suppression_entries ?? [])
  const [privacyRequests, setPrivacyRequests] = React.useState<PrivacyRequest[]>(guest.privacy_requests ?? [])
  const [busyKey, setBusyKey] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [requestType, setRequestType] = React.useState<PrivacyRequestType>("export")
  const [requesterName, setRequesterName] = React.useState(guest.display_name)
  const [requesterContact, setRequesterContact] = React.useState(guestPrimaryContact)
  const [requestDetails, setRequestDetails] = React.useState("")
  const consentByKey = new Map(consents.map((consent) => [consentKey(consent.channel, consent.purpose), consent]))

  const refreshPrivacyRequests = React.useCallback(async () => {
    if (!canManagePrivacyRequests) return
    const refreshed = await fetchJson<{ data: PrivacyRequest[] }>(`/api/crm/guests/${guest.id}/privacy-requests`)
    setPrivacyRequests(refreshed.data)
  }, [guest.id, canManagePrivacyRequests])

  React.useEffect(() => {
    setConsents(guest.guest_consents ?? [])
    setSuppressions(guest.suppression_entries ?? [])
    setPrivacyRequests(guest.privacy_requests ?? [])
    setRequestType("export")
    setRequesterName(guest.display_name)
    setRequesterContact(guestPrimaryContact)
    setRequestDetails("")
    setError(null)
    void refreshPrivacyRequests()
  }, [guest.id, guest.display_name, guest.guest_consents, guest.suppression_entries, guest.privacy_requests, guestPrimaryContact, refreshPrivacyRequests])

  async function updateConsent(item: { channel: ConsentChannel; purpose: ConsentPurpose }, status: ConsentStatus) {
    const key = consentKey(item.channel, item.purpose)
    setBusyKey(key)
    setError(null)
    try {
      await fetchJson<{ data: GuestConsent[] }>(`/api/crm/guests/${guest.id}/consents`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consents: [{
            channel: item.channel,
            purpose: item.purpose,
            status,
            source: "guest_360",
            proof: { captured_via: "guest_360_consent_center", language_version: "crm-v3.1-consent-center" },
          }],
        }),
      })
      const refreshed = await fetchJson<{ data: GuestConsent[]; suppressions: SuppressionEntry[] }>(`/api/crm/guests/${guest.id}/consents`)
      setConsents(refreshed.data)
      setSuppressions(refreshed.suppressions)
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Consent update failed")
    } finally {
      setBusyKey(null)
    }
  }

  async function createPrivacyRequest() {
    setBusyKey("privacy:create")
    setError(null)
    try {
      await fetchJson<{ data: PrivacyRequest }>(`/api/crm/guests/${guest.id}/privacy-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_type: requestType,
          requested_by_name: requesterName,
          requested_by_contact: requesterContact,
          details: requestDetails,
          metadata: { source: "guest_360_privacy_rights" },
        }),
      })
      setRequestDetails("")
      await refreshPrivacyRequests()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Privacy request failed")
    } finally {
      setBusyKey(null)
    }
  }

  async function updatePrivacyRequest(request: PrivacyRequest, action: "approve" | "complete_export" | "complete_delete" | "complete_suppression" | "reject" | "cancel") {
    setBusyKey(`${request.id}:${action}`)
    setError(null)
    try {
      await fetchJson<{ data: PrivacyRequest }>(`/api/crm/guests/${guest.id}/privacy-requests`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: request.id,
          action,
          note: `${action.replaceAll("_", " ")} from Guest 360 privacy panel`,
          metadata: { source: "guest_360_privacy_rights" },
        }),
      })
      await refreshPrivacyRequests()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Privacy request update failed")
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="space-y-[var(--space-4)]">
      {error ? <p className="rounded-[var(--radius-sm)] bg-[var(--color-danger-bg)] p-[var(--space-3)] text-[length:var(--type-footnote-size)] text-[var(--color-danger)]">{error}</p> : null}
      <Panel title="Profile data">
        <Row title="Birthday" body={formatDate(guest.birthday)} />
        <Row title="Contacts" body={`${guest.guest_contact_points?.length ?? 0} contact points`} />
        <Row title="Tags" body={`${guest.guest_tags?.length ?? 0} assigned tags`} />
      </Panel>
      <Panel title="Consent center">
        <div className="divide-y divide-[var(--color-border)]">
          {consentMatrix.map((item) => {
            const consent = consentByKey.get(consentKey(item.channel, item.purpose))
            const status = consent?.status ?? "unknown"
            const key = consentKey(item.channel, item.purpose)
            return (
              <div key={key} className="flex flex-wrap items-start justify-between gap-[var(--space-3)] py-[var(--space-3)]">
                <div className="min-w-[220px] flex-1">
                  <div className="flex flex-wrap items-center gap-[var(--space-2)]">
                    <p className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[var(--color-text)]">{item.label}</p>
                    <Badge variant={consentTone(status)}>{status}</Badge>
                  </div>
                  <p className="mt-[var(--space-1)] text-[length:var(--type-footnote-size)] text-[var(--color-text-muted)]">{item.help}</p>
                  <p className="mt-[var(--space-1)] text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">{proofSummary(consent?.proof)} - captured {formatDateTime(consent?.captured_at)}</p>
                </div>
                {canManageConsent ? <div className="flex gap-[var(--space-2)]">
                  <Button size="sm" variant={status === "granted" ? "primary" : "secondary"} loading={busyKey === key} disabled={busyKey === key} onClick={() => updateConsent(item, "granted")}>Grant</Button>
                  <Button size="sm" variant={status === "revoked" ? "destructive" : "secondary"} loading={busyKey === key} disabled={busyKey === key} onClick={() => updateConsent(item, "revoked")}>Revoke</Button>
                </div> : null}
              </div>
            )
          })}
        </div>
      </Panel>
      <Panel title="Suppression history">
        {suppressions.length ? suppressions.map((suppression) => (
          <Row key={suppression.id} title={`${suppression.channel} ${suppression.purpose} - ${suppression.reason.replaceAll("_", " ")}`} body={`${suppression.source} - ${formatDateTime(suppression.suppressed_at)} - ${proofSummary(suppression.proof)}`} />
        )) : <InlineState icon={ShieldCheck} title="No active suppression history" body="Revoked consent, unsubscribe, bounce, complaint, and privacy-request suppressions appear here." />}
      </Panel>
      {canManagePrivacyRequests ? <Panel title="Privacy rights">
        <div className="grid gap-[var(--space-3)] lg:grid-cols-[1fr_1fr]">
          <Text label="Requester" value={requesterName} onChange={(event) => setRequesterName(event.target.value)} />
          <Text label="Contact" value={requesterContact} onChange={(event) => setRequesterContact(event.target.value)} />
        </div>
        <div className="mt-[var(--space-3)] flex flex-wrap gap-[var(--space-2)]">
          {privacyRequestOptions.map((option) => (
            <Button key={option.type} size="sm" variant={requestType === option.type ? "primary" : "secondary"} onClick={() => setRequestType(option.type)}>
              {option.label}
            </Button>
          ))}
        </div>
        <Textarea className="mt-[var(--space-3)]" label="Request details" value={requestDetails} onChange={(event) => setRequestDetails(event.target.value)} placeholder="Record verification context, requested correction, or deletion scope" />
        <Button className="mt-[var(--space-3)]" size="md" leadingIcon={<Plus />} loading={busyKey === "privacy:create"} disabled={!requesterName.trim() || !requesterContact.trim() || busyKey === "privacy:create"} onClick={createPrivacyRequest}>Open request</Button>
        <div className="mt-[var(--space-4)] divide-y divide-[var(--color-border)]">
          {privacyRequests.length ? privacyRequests.map((request) => (
            <div key={request.id} className="py-[var(--space-3)]">
              <div className="flex flex-wrap items-start justify-between gap-[var(--space-3)]">
                <div className="min-w-[220px] flex-1">
                  <div className="flex flex-wrap items-center gap-[var(--space-2)]">
                    <p className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[var(--color-text)]">{privacyRequestLabel(request.request_type)}</p>
                    <Badge variant={privacyStatusTone(request.status)}>{request.status.replaceAll("_", " ")}</Badge>
                  </div>
                  <p className="mt-[var(--space-1)] text-[length:var(--type-footnote-size)] text-[var(--color-text-muted)]">{request.requested_by_name} - due {formatDate(request.due_at)} - {request.details || "No details recorded"}</p>
                  <p className="mt-[var(--space-1)] text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">{privacyRequestEvidence(request)}</p>
                </div>
                <div className="flex flex-wrap gap-[var(--space-2)]">
                  {request.status === "submitted" ? <Button size="sm" variant="secondary" loading={busyKey === `${request.id}:approve`} onClick={() => updatePrivacyRequest(request, "approve")}>Approve</Button> : null}
                  {request.status === "approved" && request.request_type === "export" ? <Button size="sm" loading={busyKey === `${request.id}:complete_export`} onClick={() => updatePrivacyRequest(request, "complete_export")}>Generate export</Button> : null}
                  {request.status === "approved" && request.request_type === "delete" ? <Button size="sm" variant="destructive" loading={busyKey === `${request.id}:complete_delete`} onClick={() => updatePrivacyRequest(request, "complete_delete")}>Anonymize</Button> : null}
                  {request.status === "approved" && !["export", "delete"].includes(request.request_type) ? <Button size="sm" loading={busyKey === `${request.id}:complete_suppression`} onClick={() => updatePrivacyRequest(request, "complete_suppression")}>Complete</Button> : null}
                  {!["completed", "rejected", "cancelled"].includes(request.status) ? <Button size="sm" variant="ghost" loading={busyKey === `${request.id}:reject`} onClick={() => updatePrivacyRequest(request, "reject")}>Reject</Button> : null}
                </div>
              </div>
            </div>
          )) : <InlineState icon={ShieldCheck} title="No privacy requests" body="Exports, deletion, correction, do-not-contact, sale-sharing opt-out, and sensitive-use limits are tracked here." />}
        </div>
      </Panel> : null}
    </div>
  )
}

const privacyRequestOptions: Array<{ type: PrivacyRequestType; label: string }> = [
  { type: "export", label: "Export" },
  { type: "delete", label: "Delete" },
  { type: "correct", label: "Correct" },
  { type: "do_not_contact", label: "Do not contact" },
  { type: "opt_out_sale_sharing", label: "Opt out sale/sharing" },
  { type: "limit_sensitive_use", label: "Limit sensitive use" },
]

function privacyRequestLabel(type: PrivacyRequestType) {
  return privacyRequestOptions.find((option) => option.type === type)?.label ?? type.replaceAll("_", " ")
}

function privacyStatusTone(status: PrivacyRequestStatus): "success" | "warning" | "default" {
  if (status === "completed") return "success"
  if (status === "rejected" || status === "cancelled") return "warning"
  return "default"
}

function privacyRequestEvidence(request: PrivacyRequest) {
  const exportJob = request.data_export_jobs?.[0]
  if (exportJob) return `Export ${exportJob.status} - generated ${formatDateTime(exportJob.generated_at)}`
  const deletionJob = request.data_deletion_jobs?.[0]
  if (deletionJob) return `Deletion ${deletionJob.status} - completed ${formatDateTime(deletionJob.completed_at)}`
  const accessLog = request.data_access_logs?.[0]
  if (accessLog) return `${accessLog.access_type.replaceAll("_", " ")} - ${formatDateTime(accessLog.created_at)}`
  return "Awaiting manager action"
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

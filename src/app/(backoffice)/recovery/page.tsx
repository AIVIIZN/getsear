"use client"

import * as React from "react"
import { AlertTriangle, CheckCircle2, ClipboardCheck, Clock3, MessageSquareText, RefreshCw, UserRoundCheck } from "lucide-react"
import { Badge } from "@/components/ui-v2/data/Badge"
import { Skeleton } from "@/components/ui-v2/data/Skeleton"
import { EmptyState } from "@/components/ui-v2/feedback/EmptyState"
import { Button } from "@/components/ui-v2/Button"
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui-v2/Card"
import { Select } from "@/components/ui-v2/inputs/Select"
import { Textarea } from "@/components/ui-v2/inputs/Textarea"
import { cn } from "@/lib/utils"

type RecoveryStatus = "new" | "assigned" | "in_progress" | "waiting_for_guest" | "resolved" | "closed" | "escalated"
type RecoveryCase = {
  id: string
  severity: "low" | "medium" | "high" | "critical"
  status: RecoveryStatus
  source_type: string
  issue_summary: string
  issue_detail?: string | null
  topics: string[]
  deadline_at?: string | null
  recommended_action?: string | null
  resolution_summary?: string | null
  recovered_at?: string | null
  recovered_revenue: number
  guests?: { display_name?: string | null; lifecycle_stage?: string | null } | null
  crm_recovery_actions?: Array<{ id: string; action_type: string; note?: string | null; created_at: string }>
  crm_recovery_followups?: Array<{ id: string; status: string; due_at?: string | null; outcome?: string | null }>
}

const statusOptions = [
  { value: "new", label: "New" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In progress" },
  { value: "waiting_for_guest", label: "Waiting for guest" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
  { value: "escalated", label: "Escalated" },
]

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const json = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(json.error ?? "Request failed")
  return json as T
}

function formatDate(value?: string | null) {
  if (!value) return "No deadline"
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value ?? 0))
}

function statusVariant(status: RecoveryStatus) {
  if (status === "resolved" || status === "closed") return "success"
  if (status === "escalated") return "danger"
  if (status === "waiting_for_guest") return "warning"
  return "primary"
}

function severityVariant(severity: RecoveryCase["severity"]) {
  if (severity === "critical" || severity === "high") return "danger"
  if (severity === "medium") return "warning"
  return "default"
}

export default function RecoveryPage() {
  const [cases, setCases] = React.useState<RecoveryCase[]>([])
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading")
  const [statusFilter, setStatusFilter] = React.useState<"open" | RecoveryStatus>("open")
  const [actionStatus, setActionStatus] = React.useState<RecoveryStatus>("in_progress")
  const [note, setNote] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const selected = cases.find((item) => item.id === selectedId) ?? null
  const openCases = cases.filter((item) => !["resolved", "closed"].includes(item.status)).length
  const overdue = cases.filter((item) => item.deadline_at && new Date(item.deadline_at).getTime() < Date.now() && !["resolved", "closed"].includes(item.status)).length
  const recoveredRevenue = cases.reduce((sum, item) => sum + Number(item.recovered_revenue ?? 0), 0)

  const loadCases = React.useCallback(async () => {
    setState("loading")
    setError(null)
    try {
      const url = statusFilter === "open" ? "/api/crm/recovery?limit=75" : `/api/crm/recovery?limit=75&status=${statusFilter}`
      const json = await fetchJson<{ data: RecoveryCase[] }>(url)
      const next = statusFilter === "open" ? json.data.filter((item) => !["resolved", "closed"].includes(item.status)) : json.data
      setCases(next)
      setSelectedId((current) => current && next.some((item) => item.id === current) ? current : next[0]?.id ?? null)
      setState("ready")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recovery cases failed to load")
      setState("error")
    }
  }, [statusFilter])

  React.useEffect(() => {
    loadCases()
  }, [loadCases])

  async function logAction() {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      const json = await fetchJson<{ data: { case: RecoveryCase } }>(`/api/crm/recovery/${selected.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action_type: "status_change", status_after: actionStatus, note: note || null }),
      })
      setCases((items) => items.map((item) => item.id === selected.id ? json.data.case : item))
      setNote("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed")
    } finally {
      setSaving(false)
    }
  }

  async function resolveCase() {
    if (!selected || !note.trim()) return
    setSaving(true)
    setError(null)
    try {
      const json = await fetchJson<{ data: { case: RecoveryCase } }>(`/api/crm/recovery/${selected.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution_summary: note }),
      })
      setCases((items) => items.map((item) => item.id === selected.id ? json.data.case : item))
      setNote("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resolve failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)] px-[var(--space-6)] py-[var(--space-6)]">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-[var(--space-6)]">
        <header className="flex flex-col gap-[var(--space-4)] lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[var(--type-caption-size)] font-[var(--weight-semibold)] uppercase text-[var(--color-text-muted)]">GuestBrain CRM</p>
            <h1 className="text-[length:var(--type-title-1-size)] font-[number:var(--weight-bold)] text-[var(--color-text)]">Service recovery center</h1>
            <p className="max-w-[760px] text-[length:var(--type-body-size)] text-[var(--color-text-muted)]">Prioritize negative feedback, assign manager actions, and prove whether guests return after recovery.</p>
          </div>
          <div className="flex flex-wrap items-center gap-[var(--space-2)]">
            <Select value={statusFilter} onChange={(value) => setStatusFilter(value as typeof statusFilter)} options={[{ value: "open", label: "Open cases" }, ...statusOptions]} ariaLabel="Filter recovery cases" />
            <Button variant="secondary" size="md" onClick={loadCases} leadingIcon={<RefreshCw />}>Refresh</Button>
          </div>
        </header>

        <section className="grid gap-[var(--space-3)] md:grid-cols-3">
          <Metric icon={<AlertTriangle />} label="Open cases" value={String(openCases)} tone={openCases > 0 ? "warning" : "success"} />
          <Metric icon={<Clock3 />} label="Overdue" value={String(overdue)} tone={overdue > 0 ? "danger" : "success"} />
          <Metric icon={<UserRoundCheck />} label="Recovered revenue" value={money(recoveredRevenue)} tone="primary" />
        </section>

        {error ? <div className="rounded-[var(--radius-sm)] border border-[var(--color-danger)] bg-[var(--color-danger-bg)] p-[var(--space-3)] text-[var(--color-danger)]">{error}</div> : null}

        <section className="grid gap-[var(--space-4)] xl:grid-cols-[minmax(360px,0.95fr)_minmax(520px,1.35fr)]">
          <Card className="min-h-[520px]">
            <CardHeader>
              <CardTitle>Recovery queue</CardTitle>
              <CardDescription>Negative feedback and manager-entered issues that need ownership.</CardDescription>
            </CardHeader>
            <CardBody>
              {state === "loading" ? Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-[88px]" />) : null}
              {state === "ready" && cases.length === 0 ? <EmptyState illustration="no-customers" title="No recovery cases" description="Negative feedback will open manager-visible recovery cases here." /> : null}
              {cases.map((item) => (
                <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={cn("rounded-[var(--radius-sm)] border p-[var(--space-4)] text-left transition-colors", selectedId === item.id ? "border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)]" : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)]")}>
                  <div className="flex items-start justify-between gap-[var(--space-3)]">
                    <div>
                      <p className="font-[var(--weight-semibold)] text-[var(--color-text)]">{item.guests?.display_name ?? "Unmatched guest"}</p>
                      <p className="line-clamp-2 text-[length:var(--type-subhead-size)] text-[var(--color-text-muted)]">{item.issue_summary}</p>
                    </div>
                    <Badge variant={severityVariant(item.severity)}>{item.severity}</Badge>
                  </div>
                  <div className="mt-[var(--space-3)] flex flex-wrap gap-[var(--space-2)]">
                    <Badge variant={statusVariant(item.status)}>{item.status.replaceAll("_", " ")}</Badge>
                    <span className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">{formatDate(item.deadline_at)}</span>
                  </div>
                </button>
              ))}
            </CardBody>
          </Card>

          <Card className="min-h-[520px]">
            {selected ? (
              <>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-[var(--space-3)]">
                    <div>
                      <CardTitle>{selected.issue_summary}</CardTitle>
                      <CardDescription>{selected.guests?.display_name ?? "Unmatched guest"} · {selected.source_type.replaceAll("_", " ")} · {formatDate(selected.deadline_at)}</CardDescription>
                    </div>
                    <Badge variant={statusVariant(selected.status)} shape="pill">{selected.status.replaceAll("_", " ")}</Badge>
                  </div>
                </CardHeader>
                <CardBody>
                  <div className="grid gap-[var(--space-3)] lg:grid-cols-2">
                    <Insight icon={<MessageSquareText />} label="Recommended action" value={selected.recommended_action ?? "Assign a manager and document the contact plan."} />
                    <Insight icon={<CheckCircle2 />} label="Return tracking" value={selected.recovered_at ? `Returned ${formatDate(selected.recovered_at)} · ${money(selected.recovered_revenue)}` : "No recovered visit attached yet."} />
                  </div>
                  {selected.issue_detail ? <p className="rounded-[var(--radius-sm)] bg-[var(--color-bg-muted)] p-[var(--space-4)] text-[var(--color-text)]">{selected.issue_detail}</p> : null}
                  <div className="flex flex-wrap gap-[var(--space-2)]">{selected.topics.map((topic) => <Badge key={topic}>{topic}</Badge>)}</div>
                  <div className="grid gap-[var(--space-3)] lg:grid-cols-[220px_1fr]">
                    <Select value={actionStatus} onChange={(value) => setActionStatus(value as RecoveryStatus)} options={statusOptions} label="Next status" />
                    <Textarea label="Manager note or resolution" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Document the guest contact, offer, or resolution." />
                  </div>
                  <div className="flex flex-wrap justify-end gap-[var(--space-2)]">
                    <Button variant="secondary" size="md" onClick={logAction} loading={saving} leadingIcon={<ClipboardCheck />}>Log action</Button>
                    <Button size="md" onClick={resolveCase} disabled={!note.trim()} loading={saving} leadingIcon={<CheckCircle2 />}>Resolve</Button>
                  </div>
                </CardBody>
              </>
            ) : (
              <CardBody className="min-h-[460px] justify-center">
                <EmptyState illustration="no-customers" title="Select a recovery case" description="Choose a case to assign, resolve, or track guest return." />
              </CardBody>
            )}
          </Card>
        </section>
      </div>
    </main>
  )
}

function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "primary" | "success" | "warning" | "danger" }) {
  return (
    <Card padding="compact">
      <div className="flex items-center gap-[var(--space-3)]">
        <span className={cn("flex size-[40px] items-center justify-center rounded-[var(--radius-sm)]", tone === "danger" ? "bg-[var(--color-danger-bg)] text-[var(--color-danger)]" : tone === "warning" ? "bg-[var(--color-warning-bg)] text-[var(--color-warning)]" : tone === "success" ? "bg-[var(--color-success-bg)] text-[var(--color-success)]" : "bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] text-[var(--color-primary)]")}>{icon}</span>
        <div>
          <p className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">{label}</p>
          <p className="text-[length:var(--type-title-3-size)] font-[number:var(--weight-bold)] text-[var(--color-text)]">{value}</p>
        </div>
      </div>
    </Card>
  )
}

function Insight({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-4)]">
      <div className="flex items-center gap-[var(--space-2)] text-[var(--color-text-muted)]">{icon}<span className="text-[length:var(--type-caption-1-size)]">{label}</span></div>
      <p className="mt-[var(--space-2)] text-[var(--color-text)]">{value}</p>
    </div>
  )
}

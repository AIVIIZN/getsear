"use client"

/**
 * V6 — back-office Audit Log page.
 *
 * Filterable history of every privileged action in the org (void, comp,
 * discount, cash drop, manager override, drawer-open, etc). Owners can
 * also export the filtered slice to CSV (manager-PIN-gated, RFC 4180).
 *
 * Data flow:
 *   - GET /api/audit-log              — paginated table
 *   - GET /api/audit-log/export       — CSV export (owner + PIN)
 *   - GET /api/staff/users (existing) — populate actor/manager dropdowns
 *
 * V6 visual: ConfirmDialog (ui-v2) + canonical ManagerPinDialog replaced
 * the V5.4.3 inline DialogContent + raw <input> pattern.
 */

import * as React from "react"
import { Download, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui-v2/Button"
import { ConfirmDialog } from "@/components/ui-v2/feedback/ConfirmDialog"
import { ManagerPinDialog } from "@/components/pos/ManagerPinDialog"
import {
  AuditLogFilters,
  type AuditFilterState,
  type UserOption,
} from "@/components/audit/AuditLogFilters"
import {
  AuditLogTable,
  type AuditTableRow,
} from "@/components/audit/AuditLogTable"
import { toast } from "sonner"

const PAGE_SIZE = 50

const EMPTY_FILTERS: AuditFilterState = {
  date_from: null,
  date_to: null,
  actor_user_id: null,
  manager_pin_user_id: null,
  action: null,
  search: null,
}

interface OrgUser {
  id: string
  email: string | null
  display_name?: string | null
  first_name?: string | null
  last_name?: string | null
  role: string
}

export default function AuditLogPage() {
  const [filters, setFilters] = React.useState<AuditFilterState>(EMPTY_FILTERS)
  const [page, setPage] = React.useState(0)
  const [rows, setRows] = React.useState<AuditTableRow[]>([])
  const [total, setTotal] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [users, setUsers] = React.useState<UserOption[]>([])
  const [managers, setManagers] = React.useState<UserOption[]>([])
  const [knownActions, setKnownActions] = React.useState<string[]>([])
  const [currentRole, setCurrentRole] = React.useState<string | null>(null)

  React.useEffect(() => {
    setPage(0)
  }, [filters])

  const buildQuery = React.useCallback(
    (extra?: Record<string, string>) => {
      const sp = new URLSearchParams()
      if (filters.date_from) sp.set("date_from", filters.date_from)
      if (filters.date_to) sp.set("date_to", filters.date_to)
      if (filters.actor_user_id) sp.set("actor_user_id", filters.actor_user_id)
      if (filters.manager_pin_user_id)
        sp.set("manager_pin_user_id", filters.manager_pin_user_id)
      if (filters.action) sp.set("action", filters.action)
      if (filters.search) sp.set("search", filters.search)
      if (extra) {
        for (const [k, v] of Object.entries(extra)) sp.set(k, v)
      }
      return sp
    },
    [filters]
  )

  const fetchRows = React.useCallback(async () => {
    setLoading(true)
    try {
      const sp = buildQuery({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      })
      const res = await fetch(`/api/audit-log?${sp.toString()}`, {
        cache: "no-store",
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const json = (await res.json()) as {
        data: AuditTableRow[]
        total: number
      }
      setRows(json.data)
      setTotal(json.total)
      setKnownActions((prev) => {
        const next = new Set(prev)
        for (const r of json.data) next.add(r.action)
        return Array.from(next).sort()
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load audit log"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [buildQuery, page])

  React.useEffect(() => {
    void fetchRows()
  }, [fetchRows])

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [staffRes, meRes] = await Promise.all([
          fetch("/api/staff", { cache: "no-store" }),
          fetch("/api/auth/me", { cache: "no-store" }),
        ])
        if (cancelled) return

        if (staffRes.ok) {
          const body = (await staffRes.json()) as { data?: OrgUser[] }
          const list = body.data ?? []
          const labelFor = (u: OrgUser) =>
            u.display_name ||
            [u.first_name, u.last_name].filter(Boolean).join(" ") ||
            u.email ||
            u.id.slice(0, 8)
          setUsers(list.map((u) => ({ id: u.id, label: labelFor(u) })))
          setManagers(
            list
              .filter((u) => ["owner", "admin", "manager"].includes(u.role))
              .map((u) => ({ id: u.id, label: labelFor(u) }))
          )
        }
        if (meRes.ok) {
          const body = (await meRes.json()) as { user?: { role?: string } }
          if (body.user?.role) setCurrentRole(body.user.role)
        }
      } catch {
        // non-fatal
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="container mx-auto max-w-7xl space-y-[var(--space-5)] p-[var(--space-6)]">
      <header className="flex flex-wrap items-end justify-between gap-[var(--space-3)]">
        <div>
          <h1 className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] tracking-tight text-[color:var(--color-text)]">
            Audit log
          </h1>
          <p className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
            Every privileged action in your organization. Append-only and
            tenant-scoped.
          </p>
        </div>
        <div className="flex items-center gap-[var(--space-2)]">
          <Button
            variant="secondary"
            size="md"
            onClick={() => void fetchRows()}
            loading={loading}
            leadingIcon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh
          </Button>
          <ExportButton filters={filters} currentRole={currentRole} />
        </div>
      </header>

      <AuditLogFilters
        value={filters}
        onChange={setFilters}
        users={users}
        managers={managers}
        knownActions={knownActions}
        loading={loading}
      />

      <AuditLogTable
        rows={rows}
        loading={loading}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// CSV export button — owner-only, manager-PIN-gated.
// Two-step UX: ConfirmDialog explains the gate; ManagerPinDialog captures
// + verifies the PIN. The verified PIN is then forwarded to the export
// endpoint, which re-validates server-side and records an audit row of
// the export itself.
// ---------------------------------------------------------------------------
function ExportButton({
  filters,
  currentRole,
}: {
  filters: AuditFilterState
  currentRole: string | null
}) {
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [pinOpen, setPinOpen] = React.useState(false)

  if (currentRole && currentRole !== "owner") return null

  const downloadWithPin = async (pin: string) => {
    const sp = new URLSearchParams()
    if (filters.date_from) sp.set("date_from", filters.date_from)
    if (filters.date_to) sp.set("date_to", filters.date_to)
    if (filters.actor_user_id) sp.set("actor_user_id", filters.actor_user_id)
    if (filters.manager_pin_user_id)
      sp.set("manager_pin_user_id", filters.manager_pin_user_id)
    if (filters.action) sp.set("action", filters.action)
    if (filters.search) sp.set("search", filters.search)
    sp.set("manager_pin", pin)

    try {
      const res = await fetch(`/api/audit-log/export?${sp.toString()}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success("Audit log exported.")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Export failed"
      toast.error(message)
    }
  }

  return (
    <>
      <Button
        size="md"
        onClick={() => setConfirmOpen(true)}
        leadingIcon={<Download className="h-4 w-4" />}
      >
        Export CSV
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Export audit log to CSV"
        description={
          <>
            This export contains every privileged action matching your current
            filters. It is owner-only and requires your manager PIN. The
            export itself will be recorded in the audit log.
          </>
        }
        confirmLabel="Continue"
        onConfirm={async () => {
          // Wait one animation frame so ConfirmDialog finishes its
          // close transition before the PIN pad mounts; the two
          // overlays must not fight for focus.
          await new Promise((resolve) => requestAnimationFrame(resolve))
          setPinOpen(true)
        }}
      />

      <ManagerPinDialog
        open={pinOpen}
        onOpenChange={setPinOpen}
        title="Confirm owner PIN"
        description="Enter your owner PIN to export the audit log."
        returnPin
        onVerified={(_managerId, _managerName, pin) => {
          if (pin) void downloadWithPin(pin)
        }}
      />
    </>
  )
}

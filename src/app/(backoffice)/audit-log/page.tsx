"use client"

/**
 * V5.4.3 — back-office Audit Log page.
 *
 * Filterable history of every privileged action in the org (void, comp,
 * discount, cash drop, manager override, drawer-open, etc). Owners can
 * also export the filtered slice to CSV (manager-PIN-gated, RFC 4180).
 *
 * Data flow:
 *   - GET /api/audit-log              — paginated table
 *   - GET /api/audit-log/export       — CSV export (owner + PIN)
 *   - GET /api/staff/users (existing) — populate actor/manager dropdowns
 */

import * as React from "react"
import { Download, RefreshCw, ShieldAlert, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AuditLogFilters, type AuditFilterState, type UserOption } from "@/components/audit/AuditLogFilters"
import { AuditLogTable, type AuditTableRow } from "@/components/audit/AuditLogTable"
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

  // Reset to page 0 when filters change.
  React.useEffect(() => {
    setPage(0)
  }, [filters])

  const buildQuery = React.useCallback(
    (extra?: Record<string, string>) => {
      const sp = new URLSearchParams()
      if (filters.date_from) sp.set("date_from", filters.date_from)
      if (filters.date_to) sp.set("date_to", filters.date_to)
      if (filters.actor_user_id) sp.set("actor_user_id", filters.actor_user_id)
      if (filters.manager_pin_user_id) sp.set("manager_pin_user_id", filters.manager_pin_user_id)
      if (filters.action) sp.set("action", filters.action)
      if (filters.search) sp.set("search", filters.search)
      if (extra) {
        for (const [k, v] of Object.entries(extra)) sp.set(k, v)
      }
      return sp
    },
    [filters]
  )

  // Load the audit rows whenever filters or page change.
  const fetchRows = React.useCallback(async () => {
    setLoading(true)
    try {
      const sp = buildQuery({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      })
      const res = await fetch(`/api/audit-log?${sp.toString()}`, { cache: "no-store" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const json = (await res.json()) as { data: AuditTableRow[]; total: number }
      setRows(json.data)
      setTotal(json.total)
      // Build the known-actions list from what we just saw, merged with the
      // existing set so the dropdown grows over time.
      setKnownActions((prev) => {
        const next = new Set(prev)
        for (const r of json.data) next.add(r.action)
        return Array.from(next).sort()
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load audit log"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [buildQuery, page])

  React.useEffect(() => {
    void fetchRows()
  }, [fetchRows])

  // Load org users for the filter dropdowns + current role for the
  // export-button gate. Best-effort; failure here only disables the
  // dropdowns, not the table.
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
    <div className="container mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
          <p className="text-sm text-muted-foreground">
            Every privileged action in your organization. Append-only and tenant-scoped.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void fetchRows()} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
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
// CSV export button — owner-only, manager-PIN-gated. The PIN modal is
// inline so the button stays self-contained.
// ---------------------------------------------------------------------------
function ExportButton({
  filters,
  currentRole,
}: {
  filters: AuditFilterState
  currentRole: string | null
}) {
  const [open, setOpen] = React.useState(false)
  const [pin, setPin] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Show the button to anyone who might be an owner; if currentRole is
  // known and isn't 'owner', hide it. Server still gates either way.
  if (currentRole && currentRole !== "owner") return null

  const onConfirm = async () => {
    if (pin.length < 4) {
      setError("Enter your PIN.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const sp = new URLSearchParams()
      if (filters.date_from) sp.set("date_from", filters.date_from)
      if (filters.date_to) sp.set("date_to", filters.date_to)
      if (filters.actor_user_id) sp.set("actor_user_id", filters.actor_user_id)
      if (filters.manager_pin_user_id) sp.set("manager_pin_user_id", filters.manager_pin_user_id)
      if (filters.action) sp.set("action", filters.action)
      if (filters.search) sp.set("search", filters.search)
      sp.set("manager_pin", pin)

      const res = await fetch(`/api/audit-log/export?${sp.toString()}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      // Filename is set by the server's Content-Disposition; provide a
      // local default in case the browser ignores it.
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success("Audit log exported.")
      setOpen(false)
      setPin("")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Export failed"
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Download className="mr-2 h-4 w-4" />
        Export CSV
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) {
            setPin("")
            setError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              Confirm owner PIN
            </DialogTitle>
            <DialogDescription>
              Audit log exports are owner-only and require your PIN. The export is itself
              recorded in the audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="audit-export-pin">Owner PIN</Label>
            <Input
              id="audit-export-pin"
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              maxLength={10}
              onKeyDown={(e) => {
                if (e.key === "Enter") void onConfirm()
              }}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={onConfirm} disabled={submitting || pin.length < 4}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Download CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

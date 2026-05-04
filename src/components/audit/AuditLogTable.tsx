"use client"

/**
 * V5.4.3 — table renderer for the audit log back-office page.
 *
 * Each row shows: timestamp, action (with color coding), actor, manager
 * PIN authorizer (if any), entity, and a "View" button that opens a
 * details panel with full before/after JSON + reason.
 *
 * Pure presentational — receives rows + handlers from the parent page.
 */

import * as React from "react"
import { ChevronDown, ChevronRight, ShieldCheck, FileSearch } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { EmptyState } from "@/components/shared/EmptyState"

export interface AuditTableRow {
  id: string
  created_at: string
  action: string
  entity_type: string
  entity_id: string | null
  description: string
  user_id: string | null
  user_name: string | null
  user_role: string | null
  manager_pin_user_id: string | null
  manager_pin_user_name: string | null
  manager_pin_user_email: string | null
  actor_email: string | null
  before_state: Record<string, unknown> | null
  after_state: Record<string, unknown> | null
  reason: string | null
  ip_address: string | null
}

interface AuditLogTableProps {
  rows: AuditTableRow[]
  loading: boolean
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
}

// Action color groups for quick visual scanning. Anything PIN-gated
// shows a shield badge regardless of group.
const DESTRUCTIVE = new Set([
  "payment_voided",
  "payment_refunded",
  "order_voided",
  "order_comped",
  "order_modified_after_close",
  "cash_drawer_variance",
])
const SENSITIVE = new Set([
  "manager_override",
  "manager_pin_changed",
  "staff_role_changed",
  "audit_log_exported",
  "customer_data_exported",
])

function actionVariant(action: string): "destructive" | "default" | "secondary" {
  if (DESTRUCTIVE.has(action)) return "destructive"
  if (SENSITIVE.has(action)) return "default"
  return "secondary"
}

function fmtTimestamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

export function AuditLogTable({
  rows,
  loading,
  total,
  page,
  pageSize,
  onPageChange,
}: AuditLogTableProps) {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set())
  const toggleRow = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const showingFrom = total === 0 ? 0 : page * pageSize + 1
  const showingTo = Math.min(total, (page + 1) * pageSize)

  if (!loading && rows.length === 0) {
    return (
      <EmptyState
        icon={FileSearch}
        title="No audit entries"
        description="No privileged actions match these filters."
      />
    )
  }

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead className="w-44">Timestamp</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Manager PIN</TableHead>
            <TableHead>Entity</TableHead>
            <TableHead className="w-24 text-right">Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const open = expanded.has(row.id)
            return (
              <React.Fragment key={row.id}>
                <TableRow className={open ? "border-b-0" : ""}>
                  <TableCell className="py-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => toggleRow(row.id)}
                      aria-label={open ? "Collapse" : "Expand"}
                    >
                      {open ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {fmtTimestamp(row.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={actionVariant(row.action)}>
                        {row.action.replace(/_/g, " ")}
                      </Badge>
                      {row.manager_pin_user_id && (
                        <ShieldCheck
                          className="h-4 w-4 text-emerald-600"
                          aria-label="Manager-PIN gated"
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm">{row.user_name ?? "—"}</span>
                      {row.actor_email && (
                        <span className="text-xs text-muted-foreground">{row.actor_email}</span>
                      )}
                      {row.user_role && (
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">
                          {row.user_role}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {row.manager_pin_user_id ? (
                      <div className="flex flex-col">
                        <span className="text-sm">{row.manager_pin_user_name ?? "—"}</span>
                        {row.manager_pin_user_email && (
                          <span className="text-xs text-muted-foreground">
                            {row.manager_pin_user_email}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm">{row.entity_type}</span>
                      {row.entity_id && (
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {row.entity_id.slice(0, 8)}…
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {row.ip_address ?? ""}
                  </TableCell>
                </TableRow>
                {open && (
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={7} className="py-3">
                      <div className="grid gap-3 px-2 md:grid-cols-2">
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Description
                          </div>
                          <div className="mt-1 text-sm">{row.description}</div>
                          {row.reason && (
                            <>
                              <div className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Reason
                              </div>
                              <div className="mt-1 text-sm">{row.reason}</div>
                            </>
                          )}
                        </div>
                        <div className="grid gap-2">
                          <StateBlock label="Before" value={row.before_state} />
                          <StateBlock label="After" value={row.after_state} />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            )
          })}

          {loading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
        <div>
          {total > 0 ? (
            <>
              Showing {showingFrom.toLocaleString()}–{showingTo.toLocaleString()} of{" "}
              {total.toLocaleString()}
            </>
          ) : (
            "No results"
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(0, page - 1))}
            disabled={loading || page === 0}
          >
            Previous
          </Button>
          <span className="px-2 text-xs">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
            disabled={loading || page + 1 >= totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}

function StateBlock({ label, value }: { label: string; value: Record<string, unknown> | null }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      {value ? (
        <ScrollArea className="mt-1 max-h-48 rounded-md border bg-background">
          <pre className="whitespace-pre-wrap break-all p-2 text-[11px] leading-tight">
            {JSON.stringify(value, null, 2)}
          </pre>
        </ScrollArea>
      ) : (
        <div className="mt-1 text-xs italic text-muted-foreground">—</div>
      )}
    </div>
  )
}

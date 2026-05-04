"use client"

/**
 * V6 — table renderer for the audit log back-office page.
 *
 * Each row shows: timestamp, action (with color coding), actor, manager
 * PIN authorizer (if any), entity, and an inline expand affordance that
 * reveals the full description, reason, and before/after JSON.
 *
 * Pure presentational — receives rows + handlers from the parent page.
 */

import * as React from "react"
import { ChevronDown, ChevronRight, ShieldCheck, FileSearch } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui-v2/data/Table"
import { Badge, type BadgeProps } from "@/components/ui-v2/data/Badge"
import { Button } from "@/components/ui-v2/Button"
import { Skeleton } from "@/components/ui-v2/data/Skeleton"
import { EmptyState } from "@/components/ui-v2/feedback/EmptyState"

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

function actionVariant(action: string): BadgeProps["variant"] {
  if (DESTRUCTIVE.has(action)) return "danger"
  if (SENSITIVE.has(action)) return "warning"
  return "default"
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

  if (loading && rows.length === 0) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} variant="table-row" />
        ))}
      </div>
    )
  }

  if (!loading && rows.length === 0) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
        <EmptyState
          icon={FileSearch}
          title="No audit entries"
          description="No privileged actions match these filters."
        />
      </div>
    )
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableCell header className="w-[40px]" />
            <TableCell header className="w-[180px]">Timestamp</TableCell>
            <TableCell header>Action</TableCell>
            <TableCell header>Actor</TableCell>
            <TableCell header>Manager PIN</TableCell>
            <TableCell header>Entity</TableCell>
            <TableCell header align="right" className="w-[120px]">IP</TableCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const open = expanded.has(row.id)
            return (
              <React.Fragment key={row.id}>
                <TableRow>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleRow(row.id)}
                      aria-label={open ? "Collapse" : "Expand"}
                      className="h-[28px] w-[28px] px-0"
                    >
                      {open ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell className="font-mono text-[length:var(--type-caption-1-size)]">
                    {fmtTimestamp(row.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-[var(--space-2)]">
                      <Badge variant={actionVariant(row.action)}>
                        {row.action.replace(/_/g, " ")}
                      </Badge>
                      {row.manager_pin_user_id && (
                        <ShieldCheck
                          className="h-4 w-4 text-[color:var(--color-success)]"
                          aria-label="Manager-PIN gated"
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-[length:var(--type-subhead-size)]">
                        {row.user_name ?? "—"}
                      </span>
                      {row.actor_email && (
                        <span className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)]">
                          {row.actor_email}
                        </span>
                      )}
                      {row.user_role && (
                        <span className="text-[length:var(--type-caption-2-size)] uppercase tracking-wide text-[color:var(--color-text-muted)]">
                          {row.user_role}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {row.manager_pin_user_id ? (
                      <div className="flex flex-col">
                        <span className="text-[length:var(--type-subhead-size)]">
                          {row.manager_pin_user_name ?? "—"}
                        </span>
                        {row.manager_pin_user_email && (
                          <span className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)]">
                            {row.manager_pin_user_email}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)]">
                        —
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-[length:var(--type-subhead-size)]">
                        {row.entity_type}
                      </span>
                      {row.entity_id && (
                        <span className="font-mono text-[length:var(--type-caption-2-size)] text-[color:var(--color-text-muted)]">
                          {row.entity_id.slice(0, 8)}…
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell
                    align="right"
                    className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)]"
                  >
                    {row.ip_address ?? ""}
                  </TableCell>
                </TableRow>
                {open && (
                  <TableRow className="bg-[color:var(--color-bg-subtle)]">
                    <TableCell
                      colSpan={7}
                      className="py-[var(--space-3)]"
                    >
                      <div className="grid gap-[var(--space-3)] px-[var(--space-2)] md:grid-cols-2">
                        <div>
                          <div className="text-[length:var(--type-caption-1-size)] font-[var(--weight-medium)] uppercase tracking-wide text-[color:var(--color-text-muted)]">
                            Description
                          </div>
                          <div className="mt-[var(--space-1)] text-[length:var(--type-subhead-size)]">
                            {row.description}
                          </div>
                          {row.reason && (
                            <>
                              <div className="mt-[var(--space-3)] text-[length:var(--type-caption-1-size)] font-[var(--weight-medium)] uppercase tracking-wide text-[color:var(--color-text-muted)]">
                                Reason
                              </div>
                              <div className="mt-[var(--space-1)] text-[length:var(--type-subhead-size)]">
                                {row.reason}
                              </div>
                            </>
                          )}
                        </div>
                        <div className="grid gap-[var(--space-2)]">
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
        </TableBody>
      </Table>

      <div className="flex items-center justify-between border-t border-[color:var(--color-border)] px-[var(--space-4)] py-[var(--space-3)] text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
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
        <div className="flex items-center gap-[var(--space-2)]">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(Math.max(0, page - 1))}
            disabled={loading || page === 0}
          >
            Previous
          </Button>
          <span className="px-[var(--space-2)] text-[length:var(--type-caption-1-size)]">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="secondary"
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

function StateBlock({
  label,
  value,
}: {
  label: string
  value: Record<string, unknown> | null
}) {
  return (
    <div>
      <div className="text-[length:var(--type-caption-1-size)] font-[var(--weight-medium)] uppercase tracking-wide text-[color:var(--color-text-muted)]">
        {label}
      </div>
      {value ? (
        <pre className="mt-[var(--space-1)] max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-[var(--space-2)] text-[length:var(--type-caption-2-size)] leading-tight">
          {JSON.stringify(value, null, 2)}
        </pre>
      ) : (
        <div className="mt-[var(--space-1)] text-[length:var(--type-caption-1-size)] italic text-[color:var(--color-text-muted)]">
          —
        </div>
      )}
    </div>
  )
}

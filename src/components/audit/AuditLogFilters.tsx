"use client"

/**
 * V5.4.3 — filters bar for the audit log back-office page.
 *
 * Filter axes:
 *   - date range (from/to, inclusive, ISO 8601)
 *   - actor user_id (dropdown of org users)
 *   - manager_pin_user_id (dropdown of managers/owners with PIN set)
 *   - action (dropdown of every AuditAction)
 *   - free-text search (description ilike)
 *
 * Controlled component — owns no state of its own; the parent page holds
 * the filter object and pushes updates via onChange.
 */

import * as React from "react"
import { Search, X, Calendar as CalendarIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface AuditFilterState {
  date_from: string | null
  date_to: string | null
  actor_user_id: string | null
  manager_pin_user_id: string | null
  action: string | null
  search: string | null
}

export interface UserOption {
  id: string
  label: string
}

interface AuditLogFiltersProps {
  value: AuditFilterState
  onChange: (next: AuditFilterState) => void
  /** All users in the org (used for both "actor" and "manager pin" dropdowns). */
  users: UserOption[]
  /** Subset of users with PIN set + manager-tier role. */
  managers: UserOption[]
  /** Distinct action values that appear in this org's audit log; used to
   * keep the action dropdown realistic instead of listing every theoretical action. */
  knownActions: string[]
  loading?: boolean
}

const SENTINEL_ALL = "__all__"

export function AuditLogFilters({
  value,
  onChange,
  users,
  managers,
  knownActions,
  loading = false,
}: AuditLogFiltersProps) {
  const update = React.useCallback(
    (patch: Partial<AuditFilterState>) => onChange({ ...value, ...patch }),
    [value, onChange]
  )

  const hasAnyFilter =
    !!value.date_from ||
    !!value.date_to ||
    !!value.actor_user_id ||
    !!value.manager_pin_user_id ||
    !!value.action ||
    !!value.search

  const clearAll = () =>
    onChange({
      date_from: null,
      date_to: null,
      actor_user_id: null,
      manager_pin_user_id: null,
      action: null,
      search: null,
    })

  // <input type="datetime-local"> emits "YYYY-MM-DDTHH:mm" without seconds
  // or zone. Convert to a real ISO string in local TZ for the API.
  const toIso = (raw: string): string | null => {
    if (!raw) return null
    const d = new Date(raw)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  const fromIso = (iso: string | null): string => {
    if (!iso) return ""
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ""
    // Local-timezone slice in YYYY-MM-DDTHH:mm.
    const tzOffsetMs = d.getTimezoneOffset() * 60_000
    return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 16)
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* Search */}
        <div className="space-y-1.5 xl:col-span-2">
          <Label htmlFor="audit-search">Search</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="audit-search"
              placeholder="Description contains…"
              className="pl-8"
              value={value.search ?? ""}
              onChange={(e) => update({ search: e.target.value || null })}
              disabled={loading}
            />
          </div>
        </div>

        {/* Date from */}
        <div className="space-y-1.5">
          <Label htmlFor="audit-from">From</Label>
          <div className="relative">
            <CalendarIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="audit-from"
              type="datetime-local"
              className="pl-8"
              value={fromIso(value.date_from)}
              onChange={(e) => update({ date_from: toIso(e.target.value) })}
              disabled={loading}
            />
          </div>
        </div>

        {/* Date to */}
        <div className="space-y-1.5">
          <Label htmlFor="audit-to">To</Label>
          <div className="relative">
            <CalendarIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="audit-to"
              type="datetime-local"
              className="pl-8"
              value={fromIso(value.date_to)}
              onChange={(e) => update({ date_to: toIso(e.target.value) })}
              disabled={loading}
            />
          </div>
        </div>

        {/* Actor */}
        <div className="space-y-1.5">
          <Label>Actor</Label>
          <Select
            value={value.actor_user_id ?? SENTINEL_ALL}
            onValueChange={(v) => update({ actor_user_id: v === SENTINEL_ALL ? null : v })}
            disabled={loading}
          >
            <SelectTrigger>
              <SelectValue placeholder="All actors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SENTINEL_ALL}>All actors</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Action */}
        <div className="space-y-1.5">
          <Label>Action</Label>
          <Select
            value={value.action ?? SENTINEL_ALL}
            onValueChange={(v) => update({ action: v === SENTINEL_ALL ? null : v })}
            disabled={loading}
          >
            <SelectTrigger>
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SENTINEL_ALL}>All actions</SelectItem>
              {knownActions.map((a) => (
                <SelectItem key={a} value={a}>
                  {a.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Manager PIN authorizer */}
        <div className="space-y-1.5">
          <Label>Manager PIN</Label>
          <Select
            value={value.manager_pin_user_id ?? SENTINEL_ALL}
            onValueChange={(v) => update({ manager_pin_user_id: v === SENTINEL_ALL ? null : v })}
            disabled={loading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Any (or none)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SENTINEL_ALL}>Any (or none)</SelectItem>
              {managers.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {hasAnyFilter && (
        <div className="mt-4 flex justify-end">
          <Button variant="ghost" size="sm" onClick={clearAll} disabled={loading}>
            <X className="mr-1.5 h-3.5 w-3.5" />
            Clear filters
          </Button>
        </div>
      )}
    </div>
  )
}

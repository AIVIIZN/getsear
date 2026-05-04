"use client"

/**
 * V6 — filters bar for the audit log back-office page.
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
import { Text } from "@/components/ui-v2/inputs/Text"
import { Select } from "@/components/ui-v2/inputs/Select"
import { Button } from "@/components/ui-v2/Button"

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
  /** Distinct action values that appear in this org's audit log. */
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
    const tzOffsetMs = d.getTimezoneOffset() * 60_000
    return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 16)
  }

  const actorOptions = React.useMemo(
    () => [
      { value: SENTINEL_ALL, label: "All actors" },
      ...users.map((u) => ({ value: u.id, label: u.label })),
    ],
    [users]
  )
  const managerOptions = React.useMemo(
    () => [
      { value: SENTINEL_ALL, label: "Any (or none)" },
      ...managers.map((u) => ({ value: u.id, label: u.label })),
    ],
    [managers]
  )
  const actionOptions = React.useMemo(
    () => [
      { value: SENTINEL_ALL, label: "All actions" },
      ...knownActions.map((a) => ({ value: a, label: a.replace(/_/g, " ") })),
    ],
    [knownActions]
  )

  return (
    <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-[var(--space-4)]">
      <div className="grid gap-[var(--space-3)] md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* Search */}
        <div className="xl:col-span-2">
          <Text
            placeholder="Search description..."
            value={value.search ?? ""}
            onChange={(e) => update({ search: e.target.value || null })}
            disabled={loading}
            label="Search"
            leadingIcon={<Search className="h-4 w-4" />}
          />
        </div>

        {/* Date from */}
        <div>
          <Text
            type="datetime-local"
            value={fromIso(value.date_from)}
            onChange={(e) => update({ date_from: toIso(e.target.value) })}
            disabled={loading}
            label="From"
            leadingIcon={<CalendarIcon className="h-4 w-4" />}
          />
        </div>

        {/* Date to */}
        <div>
          <Text
            type="datetime-local"
            value={fromIso(value.date_to)}
            onChange={(e) => update({ date_to: toIso(e.target.value) })}
            disabled={loading}
            label="To"
            leadingIcon={<CalendarIcon className="h-4 w-4" />}
          />
        </div>

        {/* Actor */}
        <div>
          <Select
            label="Actor"
            options={actorOptions}
            value={value.actor_user_id ?? SENTINEL_ALL}
            onChange={(v) =>
              update({ actor_user_id: v === SENTINEL_ALL ? null : v })
            }
            disabled={loading}
          />
        </div>

        {/* Action */}
        <div>
          <Select
            label="Action"
            options={actionOptions}
            value={value.action ?? SENTINEL_ALL}
            onChange={(v) => update({ action: v === SENTINEL_ALL ? null : v })}
            disabled={loading}
          />
        </div>

        {/* Manager PIN authorizer */}
        <div>
          <Select
            label="Manager PIN"
            options={managerOptions}
            value={value.manager_pin_user_id ?? SENTINEL_ALL}
            onChange={(v) =>
              update({ manager_pin_user_id: v === SENTINEL_ALL ? null : v })
            }
            disabled={loading}
          />
        </div>
      </div>

      {hasAnyFilter && (
        <div className="mt-[var(--space-3)] flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            disabled={loading}
            leadingIcon={<X className="h-3.5 w-3.5" />}
          >
            Clear filters
          </Button>
        </div>
      )}
    </div>
  )
}

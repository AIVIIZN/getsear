'use client'

import { FormEvent, useMemo, useState } from 'react'
import { AlertTriangle, Check, Loader2, Phone, Plus, Search, Sparkles, UserRound, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { OrderGuestMemory } from '@/stores/order-store'

type GuestLookupResponse = {
  data?: OrderGuestMemory[]
  error?: string
}

interface GuestAttachmentCardProps {
  guest: OrderGuestMemory | null
  orderTotalCents: number
  onAttach: (guest: OrderGuestMemory) => Promise<void> | void
  onDetach: () => Promise<void> | void
}

function formatDate(value: string | null): string {
  if (!value) return 'No recent visit'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value))
}

function splitName(value: string): { first_name: string | null; last_name: string | null } {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first_name: null, last_name: null }
  if (parts.length === 1) return { first_name: parts[0], last_name: null }
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') }
}

export function GuestAttachmentCard({ guest, orderTotalCents, onAttach, onDetach }: GuestAttachmentCardProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OrderGuestMemory[]>([])
  const [loading, setLoading] = useState(false)
  const [attachingId, setAttachingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [enrolling, setEnrolling] = useState(false)
  const [detaching, setDetaching] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createPhone, setCreatePhone] = useState('')
  const [createEmail, setCreateEmail] = useState('')

  const primaryWarning = useMemo(() => guest?.allergies[0] ?? null, [guest])
  const topPreference = useMemo(() => guest?.preferences[0] ?? null, [guest])

  async function searchGuests(event?: FormEvent) {
    event?.preventDefault()
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/crm/guests/lookup?q=${encodeURIComponent(trimmed)}&limit=5`)
      const json = (await res.json().catch(() => ({}))) as GuestLookupResponse
      if (!res.ok) {
        toast.error(json.error ?? 'Guest lookup failed')
        return
      }
      setResults(json.data ?? [])
    } catch {
      toast.error('Guest lookup failed')
    } finally {
      setLoading(false)
    }
  }

  async function attachGuest(nextGuest: OrderGuestMemory) {
    setAttachingId(nextGuest.id)
    try {
      await onAttach(nextGuest)
      setQuery('')
      setResults([])
      toast.success(`${nextGuest.display_name} attached`)
    } finally {
      setAttachingId(null)
    }
  }

  async function createAndAttach(event: FormEvent) {
    event.preventDefault()
    const displayName = createName.trim()
    if (!displayName) {
      toast.error('Guest name is required')
      return
    }

    const contact_points = [
      createPhone.trim()
        ? { contact_type: 'phone', value: createPhone.trim(), is_primary: true, source: 'pos_checkout' }
        : null,
      createEmail.trim()
        ? { contact_type: 'email', value: createEmail.trim(), is_primary: true, source: 'pos_checkout' }
        : null,
    ].filter(Boolean)

    setCreating(true)
    try {
      const nameParts = splitName(displayName)
      const res = await fetch('/api/crm/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName,
          first_name: nameParts.first_name,
          last_name: nameParts.last_name,
          lifecycle_stage: 'prospect',
          metadata: { source: 'pos_checkout' },
          contact_points,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.data?.id) {
        toast.error(json.error ?? 'Failed to create guest')
        return
      }

      await attachGuest({
        id: json.data.id,
        display_name: json.data.display_name ?? displayName,
        phone: createPhone.trim() || null,
        email: createEmail.trim() || null,
        lifecycle_stage: json.data.lifecycle_stage ?? 'prospect',
        is_vip: Boolean(json.data.is_vip),
        total_visits: Number(json.data.total_visits ?? 0),
        total_spend: Number(json.data.total_spend ?? 0),
        last_visit_at: json.data.last_visit_at ?? null,
        allergies: [],
        preferences: [],
      })
      setCreateName('')
      setCreatePhone('')
      setCreateEmail('')
    } catch {
      toast.error('Failed to create guest')
    } finally {
      setCreating(false)
    }
  }

  async function enrollLoyalty() {
    if (!guest?.phone) return
    setEnrolling(true)
    try {
      const nameParts = splitName(guest.display_name)
      const res = await fetch('/api/loyalty/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: guest.phone,
          first_name: nameParts.first_name ?? undefined,
          last_name: nameParts.last_name ?? undefined,
          order_total: orderTotalCents,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error ?? 'Loyalty enrollment failed')
        return
      }
      toast.success(json.data?.is_new ? 'Loyalty account started' : 'Guest is already enrolled')
    } catch {
      toast.error('Loyalty enrollment failed')
    } finally {
      setEnrolling(false)
    }
  }

  async function detachGuest() {
    setDetaching(true)
    try {
      await onDetach()
      toast.info('Guest detached')
    } finally {
      setDetaching(false)
    }
  }

  if (guest) {
    return (
      <div className="mx-4 mb-3 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-[var(--space-3)] shadow-[var(--shadow-low)]">
        <div className="flex items-start justify-between gap-[var(--space-2)]">
          <div className="min-w-0">
            <div className="flex items-center gap-[var(--space-2)]">
              <UserRound className="h-4 w-4 shrink-0 text-[color:var(--color-primary)]" />
              <p className="truncate text-[length:var(--type-callout-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
                {guest.display_name}
              </p>
              {guest.is_vip && (
                <span className="rounded-[var(--radius-xs)] bg-[color:var(--color-warning-bg)] px-[var(--space-2)] py-[2px] text-[length:var(--type-caption-size)] font-[var(--weight-bold)] text-[color:var(--color-warning)]">
                  VIP
                </span>
              )}
            </div>
            <div className="mt-[var(--space-2)] flex flex-wrap gap-[var(--space-2)] text-[length:var(--type-caption-size)] text-[color:var(--color-text-muted)]">
              <span>{guest.total_visits} visits</span>
              <span>{formatDate(guest.last_visit_at)}</span>
              {guest.phone && <span>{guest.phone}</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={detachGuest}
            disabled={detaching}
            className="btn-press flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-hover)] focus-visible:outline-2 focus-visible:outline-[color:var(--color-border-focus)] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Detach guest"
          >
            {detaching ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
          </button>
        </div>

        {(primaryWarning || topPreference) && (
          <div className="mt-[var(--space-3)] grid gap-[var(--space-2)]">
            {primaryWarning && (
              <div className="flex items-center gap-[var(--space-2)] rounded-[var(--radius-sm)] border border-[color:var(--color-danger)] bg-[color:var(--color-danger-bg)] px-[var(--space-2)] py-[var(--space-2)] text-[length:var(--type-footnote-size)] text-[color:var(--color-danger)]">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="truncate">{primaryWarning.allergen} allergy</span>
              </div>
            )}
            {topPreference && (
              <div className="flex items-center gap-[var(--space-2)] rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-bg-subtle)] px-[var(--space-2)] py-[var(--space-2)] text-[length:var(--type-footnote-size)] text-[color:var(--color-text)]">
                <Sparkles className="h-4 w-4 shrink-0 text-[color:var(--color-primary)]" />
                <span className="truncate">{topPreference.preference_key}</span>
              </div>
            )}
          </div>
        )}

        {guest.phone && (
          <button
            type="button"
            onClick={enrollLoyalty}
            disabled={enrolling}
            className="btn-press mt-[var(--space-3)] flex h-11 w-full items-center justify-center gap-[var(--space-2)] rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-bg-subtle)] text-[length:var(--type-footnote-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {enrolling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Loyalty handoff
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="mx-4 mb-3 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-[var(--space-3)] shadow-[var(--shadow-low)]">
      <form onSubmit={searchGuests} className="flex gap-[var(--space-2)]">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-[var(--space-3)] top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--color-text-muted)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Phone, email, or name"
            className="h-11 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-bg-subtle)] pl-9 pr-[var(--space-3)] text-[length:var(--type-subhead-size)] outline-none focus:border-[color:var(--color-border-focus)]"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="btn-press flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[color:var(--color-primary)] text-[color:var(--color-primary-fg)] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Search guests"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </button>
      </form>

      {results.length > 0 && (
        <div className="mt-[var(--space-2)] grid gap-[var(--space-2)]">
          {results.map((result) => (
            <button
              key={result.id}
              type="button"
              onClick={() => attachGuest(result)}
              disabled={attachingId === result.id}
              className={cn(
                'btn-press flex min-h-[44px] items-center justify-between gap-[var(--space-2)] rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-[var(--space-3)] py-[var(--space-2)] text-left',
                'hover:border-[color:var(--color-border-strong)] hover:bg-[color:var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-40'
              )}
            >
              <span className="min-w-0">
                <span className="block truncate text-[length:var(--type-subhead-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
                  {result.display_name}
                </span>
                <span className="mt-[2px] flex items-center gap-[var(--space-1)] text-[length:var(--type-caption-size)] text-[color:var(--color-text-muted)]">
                  <Phone className="h-3 w-3" />
                  {result.phone ?? result.email ?? `${result.total_visits} visits`}
                </span>
              </span>
              {attachingId === result.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={createAndAttach} className="mt-[var(--space-3)] grid grid-cols-2 gap-[var(--space-2)] border-t border-[color:var(--color-border)] pt-[var(--space-3)]">
        <input
          value={createName}
          onChange={(event) => setCreateName(event.target.value)}
          placeholder="New guest name"
          className="col-span-2 h-11 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-bg-subtle)] px-[var(--space-3)] text-[length:var(--type-footnote-size)] outline-none focus:border-[color:var(--color-border-focus)]"
        />
        <input
          value={createPhone}
          onChange={(event) => setCreatePhone(event.target.value)}
          placeholder="Phone"
          className="h-11 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-bg-subtle)] px-[var(--space-3)] text-[length:var(--type-footnote-size)] outline-none focus:border-[color:var(--color-border-focus)]"
        />
        <input
          value={createEmail}
          onChange={(event) => setCreateEmail(event.target.value)}
          placeholder="Email"
          className="h-11 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-bg-subtle)] px-[var(--space-3)] text-[length:var(--type-footnote-size)] outline-none focus:border-[color:var(--color-border-focus)]"
        />
        <button
          type="submit"
          disabled={creating}
          className="btn-press col-span-2 flex h-11 items-center justify-center gap-[var(--space-2)] rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-bg-subtle)] text-[length:var(--type-footnote-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Create and attach
        </button>
      </form>
    </div>
  )
}

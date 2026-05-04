'use client'

/**
 * V5.4.1 — modal that surfaces a stale-order optimistic-lock conflict.
 *
 * Listens for the global `STALE_ORDER_EVENT` emitted by `mutateOrder()` in
 * `src/lib/orders/api-client.ts`. When fired, shows the user:
 *
 *   - A clear "Someone updated this order" headline (no jargon).
 *   - A side-by-side diff: the fields they tried to change vs the current
 *     server state for those same fields.
 *   - Two buttons:
 *       "Refresh & discard" — closes the modal, lets the page re-fetch.
 *       "Refresh & re-apply" — re-runs the user's mutation with the new
 *                              version. If THAT also 409s, modal re-opens.
 *
 * Mount once at the (pos) layout level; multiple components that mutate
 * orders will all share this single modal.
 */

import { useEffect, useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw, RotateCw } from 'lucide-react'
import {
  STALE_ORDER_EVENT,
  type StaleOrderEventDetail,
  mutateOrder,
} from '@/lib/orders/api-client'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StaleOrderModalProps {
  /**
   * Optional callback fired after the user picks "refresh and discard" so the
   * parent page can re-fetch the affected order. Receives the conflicting
   * order's id. The modal closes either way.
   */
  onRefresh?: (orderId: string) => void
}

interface DiffRow {
  field: string
  yourValue: unknown
  serverValue: unknown
}

// ---------------------------------------------------------------------------
// Diff builder
// ---------------------------------------------------------------------------

/**
 * Build a human-readable diff between the body the user attempted to send
 * and the current server state. Only shows fields that appear in both AND
 * differ; raw IDs / timestamps are skipped to keep the dialog scannable.
 */
function buildDiff(
  attemptedBody: unknown,
  serverState: Record<string, unknown>
): DiffRow[] {
  if (!attemptedBody || typeof attemptedBody !== 'object') return []
  const attempted = attemptedBody as Record<string, unknown>

  const SKIP_FIELDS = new Set([
    'id',
    'org_id',
    'created_at',
    'updated_at',
    'version',
    'sent_at',
    'voided_at',
    'closed_at',
  ])

  const rows: DiffRow[] = []
  for (const [field, yourValue] of Object.entries(attempted)) {
    if (SKIP_FIELDS.has(field)) continue
    const serverValue = serverState[field]
    if (!shallowEqual(yourValue, serverValue)) {
      rows.push({ field, yourValue, serverValue })
    }
  }

  // If we couldn't infer any meaningful diff (e.g., the request was a verb
  // like /send with empty body), surface a few high-signal server fields
  // instead so the user has SOMETHING to act on.
  if (rows.length === 0) {
    const SHOW_FALLBACK = ['status', 'total', 'amount_paid', 'balance_due', 'guest_count']
    for (const field of SHOW_FALLBACK) {
      if (field in serverState) {
        rows.push({ field, yourValue: '—', serverValue: serverState[field] })
      }
    }
  }

  return rows
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  if (typeof a !== typeof b) return false
  // Cheap deep-ish compare via JSON.stringify; fine for our diff use case
  // (no Date/Set/Map in the request bodies — they're all JSON already).
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? 'yes' : 'no'
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function formatField(f: string): string {
  return f.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function StaleOrderModal({ onRefresh }: StaleOrderModalProps = {}) {
  const [event, setEvent] = useState<StaleOrderEventDetail | null>(null)
  const [reapplying, setReapplying] = useState(false)

  // Subscribe to the global event. The handler is stable across renders
  // because `setEvent` is identity-stable, so we don't need a ref dance.
  useEffect(() => {
    function handler(e: Event) {
      const ce = e as CustomEvent<StaleOrderEventDetail>
      setEvent(ce.detail)
    }
    window.addEventListener(STALE_ORDER_EVENT, handler)
    return () => window.removeEventListener(STALE_ORDER_EVENT, handler)
  }, [])

  const handleClose = useCallback(() => {
    if (event) onRefresh?.(event.orderId)
    setEvent(null)
  }, [event, onRefresh])

  const handleReapply = useCallback(async () => {
    if (!event) return
    setReapplying(true)
    try {
      // Re-run with the NEW version. If this 409s again the api-client will
      // emit another event and our handler will replace `event` with the
      // fresher conflict.
      await mutateOrder(event.attemptedRequest.url, event.orderId, {
        method: event.attemptedRequest.method as 'POST' | 'PATCH' | 'DELETE' | 'PUT',
        body: event.attemptedRequest.body,
        ifMatchVersion: event.conflict.current_version,
        // Don't fire the event again on this re-attempt — we want to throw
        // and handle locally so we don't double-render.
        silent: true,
      })
      toast.success('Re-applied successfully')
      onRefresh?.(event.orderId)
      setEvent(null)
    } catch (err) {
      // If this is yet another stale conflict, the silent re-attempt threw a
      // StaleOrderError. Surface it inline as the next event so the user
      // sees the latest server state — same modal, fresh diff.
      const errMsg = err instanceof Error ? err.message : 'Re-apply failed'
      // The api-client throws a StaleOrderError that has `conflict` + `attemptedRequest`.
      // We can detect by name (avoid importing the class to keep this file lean
      // — no extra type juggling needed).
      const maybeStale = err as { name?: string; conflict?: unknown; attemptedRequest?: unknown; orderId?: string }
      if (maybeStale.name === 'StaleOrderError' && maybeStale.conflict && maybeStale.attemptedRequest) {
        setEvent({
          orderId: maybeStale.orderId ?? event.orderId,
          conflict: maybeStale.conflict as StaleOrderEventDetail['conflict'],
          attemptedRequest: maybeStale.attemptedRequest as StaleOrderEventDetail['attemptedRequest'],
        })
      } else {
        toast.error(errMsg)
      }
    } finally {
      setReapplying(false)
    }
  }, [event, onRefresh])

  if (!event) return null

  const diff = buildDiff(event.attemptedRequest.body, event.conflict.current_state)

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning-bg">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-lg">Someone updated this order</DialogTitle>
              <DialogDescription className="mt-1">
                Another terminal saved a change while you were editing. Refresh to see the latest version, then re-apply your changes.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {diff.length > 0 && (
          <div className="my-4 rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-3 gap-0 bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <div>Field</div>
              <div>You sent</div>
              <div>Server now</div>
            </div>
            <div className="divide-y divide-border">
              {diff.map((row) => (
                <div
                  key={row.field}
                  className="grid grid-cols-3 gap-0 px-3 py-2 text-sm"
                >
                  <div className="font-medium text-foreground truncate">
                    {formatField(row.field)}
                  </div>
                  <div className="text-warning line-clamp-2 break-words">
                    {formatValue(row.yourValue)}
                  </div>
                  <div className="text-success line-clamp-2 break-words">
                    {formatValue(row.serverValue)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={reapplying}
            type="button"
            className="h-11 touch-target"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh & discard
          </Button>
          <Button
            onClick={handleReapply}
            disabled={reapplying}
            type="button"
            className="h-11 touch-target"
          >
            <RotateCw className={`mr-2 h-4 w-4 ${reapplying ? 'animate-spin' : ''}`} />
            {reapplying ? 'Re-applying…' : 'Refresh & re-apply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

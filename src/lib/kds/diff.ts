/**
 * Pure diff library for KDS tickets.
 *
 * Detects which items on an order are part of the original "send to kitchen"
 * batch vs. items added (and re-sent) after the order was already in the
 * kitchen. Items in the latter group are flagged so the KDS can render an
 * "ADD" badge -- this lets line cooks immediately notice late additions
 * during service.
 *
 * No I/O, no React, no Supabase. Trivially unit-testable.
 */

export interface DiffableOrderItem {
  id: string
  sent_at: string | null
  is_void?: boolean | null
}

export type ChangeKind = 'ORIGINAL' | 'ADD' | 'REMOVE' | 'MODIFY'

export interface ItemChange {
  id: string
  kind: ChangeKind
  is_add: boolean
}

export interface TicketDiff {
  changes: ItemChange[]
  byId: Map<string, ItemChange>
  hasAdds: boolean
}

/**
 * Items sent within ADD_WINDOW_MS of the earliest send timestamp are
 * considered part of the original batch. Anything sent later is an ADD.
 *
 * 5 seconds covers the realistic spread when a server hits "send" and the
 * UPDATE batch lands across rows; a true add-on (server walks back to the
 * POS and adds another item) is always many seconds -- usually minutes --
 * later.
 */
export const ADD_WINDOW_MS = 5_000

/**
 * Compute which sent items on an order are ADDs relative to the original
 * send batch.
 *
 * Logic:
 *   1. Filter to non-void items with a sent_at timestamp (unsent items
 *      never appear on the KDS).
 *   2. Find the earliest sent_at -- that anchors the original batch.
 *   3. Any item whose sent_at is more than ADD_WINDOW_MS after the anchor
 *      is flagged is_add: true.
 *
 * Returns the same structure regardless of whether any ADDs exist; callers
 * can branch on hasAdds.
 */
export function diffTicketItems(items: DiffableOrderItem[]): TicketDiff {
  const changes: ItemChange[] = []
  const byId = new Map<string, ItemChange>()

  const sentItems = items.filter((i) => i.sent_at != null && !i.is_void)

  if (sentItems.length === 0) {
    return { changes, byId, hasAdds: false }
  }

  let anchorMs = Number.POSITIVE_INFINITY
  for (const it of sentItems) {
    const t = Date.parse(it.sent_at as string)
    if (Number.isFinite(t) && t < anchorMs) anchorMs = t
  }

  if (!Number.isFinite(anchorMs)) {
    for (const it of items) {
      const change: ItemChange = { id: it.id, kind: 'ORIGINAL', is_add: false }
      changes.push(change)
      byId.set(it.id, change)
    }
    return { changes, byId, hasAdds: false }
  }

  let hasAdds = false
  for (const it of items) {
    let isAdd = false
    if (it.sent_at != null && !it.is_void) {
      const t = Date.parse(it.sent_at)
      if (Number.isFinite(t) && t - anchorMs > ADD_WINDOW_MS) {
        isAdd = true
        hasAdds = true
      }
    }
    const change: ItemChange = {
      id: it.id,
      kind: isAdd ? 'ADD' : 'ORIGINAL',
      is_add: isAdd,
    }
    changes.push(change)
    byId.set(it.id, change)
  }

  return { changes, byId, hasAdds }
}

/**
 * Convenience: just the set of item IDs flagged as ADDs.
 */
export function getAddItemIds(items: DiffableOrderItem[]): Set<string> {
  const diff = diffTicketItems(items)
  const ids = new Set<string>()
  for (const c of diff.changes) {
    if (c.is_add) ids.add(c.id)
  }
  return ids
}

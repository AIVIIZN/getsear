/**
 * Order-specific sync logic: create, update, add items, void.
 * Handles offline order creation with local IDs, syncing to server,
 * and updating local cache with server-assigned order numbers.
 *
 * V5.3.1: every replayed mutation carries an `Idempotency-Key` header taken
 * from `entry.idempotency_key`. The server's `withIdempotency` middleware
 * dedupes by `(key, route, org_id)` so retries after a network blip return
 * the original response instead of duplicating the write.
 */

import type { SyncQueueEntry } from './db'
import { markOrderSynced } from './orders-cache'

/** Build standard headers including the per-entry Idempotency-Key (V5.3.1)
 *  and an optional `If-Match` (V5.4.1) when the queue entry's payload carries
 *  an `expected_version` field. The offline queue itself does not yet track
 *  versions across reconnects (a queued mutation may be N versions behind by
 *  the time it lands), so this header is only set when callers explicitly
 *  attach one — typically NOT desired for offline replay (we want the server
 *  to accept the buffered write). Left in place for forward-compat. */
function syncHeaders(entry: SyncQueueEntry): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (entry.idempotency_key) h['Idempotency-Key'] = entry.idempotency_key
  const v = (entry.payload as { expected_version?: number | null }).expected_version
  if (typeof v === 'number' && v > 0) {
    h['If-Match'] = String(v)
  }
  return h
}

/**
 * Process an order sync queue entry.
 */
export async function processOrderSync(entry: SyncQueueEntry): Promise<void> {
  switch (entry.operation) {
    case 'create_order':
      await syncCreateOrder(entry)
      break
    case 'update_order':
      await syncUpdateOrder(entry)
      break
    case 'add_order_items':
      await syncAddOrderItems(entry)
      break
    case 'void_order':
      await syncVoidOrder(entry)
      break
    case 'close_order':
      await syncCloseOrder(entry)
      break
    default:
      throw new Error(`Unknown order operation: ${entry.operation}`)
  }
}

/**
 * Sync a newly created offline order to the server.
 */
async function syncCreateOrder(entry: SyncQueueEntry): Promise<void> {
  const payload = entry.payload

  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: syncHeaders(entry),
    body: JSON.stringify({
      ...payload,
      client_id: entry.entity_id, // Send the offline ID as client_id for dedup
      offline_created: true,
    }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))

    // Check for duplicate: if server already has this order (idempotent)
    if (response.status === 409 && body.existing_id) {
      await markOrderSynced(entry.entity_id, body.order_number)
      return
    }

    throw new Error(body.error ?? `Create order failed: ${response.status}`)
  }

  const result = await response.json()

  // Update local cache with server-assigned order number
  await markOrderSynced(entry.entity_id, result.order_number ?? result.data?.order_number)
}

/**
 * Sync an order update to the server.
 */
async function syncUpdateOrder(entry: SyncQueueEntry): Promise<void> {
  const response = await fetch(`/api/orders/${entry.entity_id}`, {
    method: 'PATCH',
    headers: syncHeaders(entry),
    body: JSON.stringify(entry.payload),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error ?? `Update order failed: ${response.status}`)
  }

  await markOrderSynced(entry.entity_id)
}

/**
 * Sync added items to an existing order on the server.
 */
async function syncAddOrderItems(entry: SyncQueueEntry): Promise<void> {
  const response = await fetch(`/api/orders/${entry.entity_id}/items`, {
    method: 'POST',
    headers: syncHeaders(entry),
    body: JSON.stringify(entry.payload),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error ?? `Add items failed: ${response.status}`)
  }

  await markOrderSynced(entry.entity_id)
}

/**
 * Sync a voided order to the server.
 */
async function syncVoidOrder(entry: SyncQueueEntry): Promise<void> {
  const response = await fetch(`/api/orders/${entry.entity_id}/void`, {
    method: 'POST',
    headers: syncHeaders(entry),
    body: JSON.stringify(entry.payload),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error ?? `Void order failed: ${response.status}`)
  }
}

/**
 * Sync a closed order to the server.
 */
async function syncCloseOrder(entry: SyncQueueEntry): Promise<void> {
  const response = await fetch(`/api/orders/${entry.entity_id}/close`, {
    method: 'POST',
    headers: syncHeaders(entry),
    body: JSON.stringify(entry.payload),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error ?? `Close order failed: ${response.status}`)
  }

  await markOrderSynced(entry.entity_id)
}

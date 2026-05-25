/**
 * Payment sync: cash payments and store-and-forward card settlements.
 * Cash payments are straightforward. Card payments require Valor settlement on reconnect.
 *
 * V5.3.1: each fetch carries an `Idempotency-Key` header sourced from the
 * queue entry. The server middleware dedupes on `(key, route, org_id)`.
 */

import type { SyncQueueEntry } from './db'

function syncHeaders(entry: SyncQueueEntry): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (entry.idempotency_key) h['Idempotency-Key'] = entry.idempotency_key
  return h
}

/**
 * Process a payment sync queue entry.
 */
export async function processPaymentSync(entry: SyncQueueEntry): Promise<void> {
  switch (entry.operation) {
    case 'create_payment':
      await syncCreatePayment(entry)
      break
    case 'settle_payment':
      await syncSettlePayment(entry)
      break
    default:
      throw new Error(`Unknown payment operation: ${entry.operation}`)
  }
}

/**
 * Sync a cash payment to the server.
 */
async function syncCreatePayment(entry: SyncQueueEntry): Promise<void> {
  const response = await fetch('/api/payments/process', {
    method: 'POST',
    headers: syncHeaders(entry),
    body: JSON.stringify({
      ...entry.payload,
      client_id: entry.entity_id, // For dedup
      offline_created: true,
    }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))

    // Idempotent: if payment already exists, treat as success
    if (response.status === 409) return

    throw new Error(body.error ?? `Create payment failed: ${response.status}`)
  }
}

/**
 * Settle a store-and-forward card payment via Valor.
 * This sends the stored authorization to the Valor settlement API.
 */
async function syncSettlePayment(entry: SyncQueueEntry): Promise<void> {
  const payload = entry.payload

  // Step 1: Settle with Valor
  const valorResponse = await fetch('/api/payments/valor/settle', {
    method: 'POST',
    headers: syncHeaders(entry),
    body: JSON.stringify({
      transaction_ref: payload.valor_transaction_ref,
      amount_cents: payload.amount_cents,
      tip_cents: payload.tip_cents ?? 0,
      terminal_id: payload.terminal_id,
      original_auth_at: payload.created_at,
    }),
  })

  if (!valorResponse.ok) {
    const body = await valorResponse.json().catch(() => ({}))

    // If settlement window expired (24hr), flag for manual review
    if (body.code === 'settlement_expired') {
      throw new Error(`conflict: Settlement window expired for $${((payload.amount_cents as number) / 100).toFixed(2)} card payment. Manual review required.`)
    }

    throw new Error(body.error ?? `Valor settlement failed: ${valorResponse.status}`)
  }

  // Step 2: Record the settled payment in Supabase
  const response = await fetch('/api/payments/process', {
    method: 'POST',
    headers: syncHeaders(entry),
    body: JSON.stringify({
      ...payload,
      client_id: entry.entity_id,
      offline_created: true,
      settled: true,
    }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    if (response.status === 409) return // Already recorded
    throw new Error(body.error ?? `Record payment failed: ${response.status}`)
  }
}

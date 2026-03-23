/**
 * Store-and-Forward for Offline Payments
 *
 * When the Valor API is unreachable (network down):
 * - Queues card payment locally (server-side in memory + database)
 * - Stores: encrypted card token (NOT PAN), amount, order_id, timestamp
 * - When connectivity returns: processes queued payments in order
 * - Notifies server of results (approved/declined)
 *
 * Risk limits (configurable):
 * - Max offline transaction: $200 (20000 cents)
 * - Max total queued: $2,000 (200000 cents)
 * - Timeout: queued payments must be processed within 24 hours
 *
 * SECURITY: This module NEVER stores full card numbers. Only processor tokens,
 * last 4 digits, and card brand are stored.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { getValorClient } from '@/lib/payments/valor-client-loader'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OfflinePayment {
  id: string
  order_id: string
  org_id: string
  location_id: string
  amount_cents: number
  tip_cents: number
  processor_token: string  // Encrypted token from terminal, NEVER raw PAN
  card_last_four: string
  card_brand: string
  queued_at: string
  status: 'queued' | 'processing' | 'approved' | 'declined' | 'expired'
  processed_at: string | null
  error_message: string | null
  staff_id: string
}

export interface QueueResult {
  success: boolean
  queued_payment_id: string | null
  error?: string
  queue_count: number
  queue_total_cents: number
}

export interface ProcessResult {
  processed: number
  approved: number
  declined: number
  expired: number
  results: Array<{
    id: string
    order_id: string
    amount_cents: number
    status: 'approved' | 'declined' | 'expired'
    error_message: string | null
  }>
}

// ---------------------------------------------------------------------------
// Constants (configurable via env)
// ---------------------------------------------------------------------------

const MAX_OFFLINE_TRANSACTION_CENTS = parseInt(
  process.env.MAX_OFFLINE_TRANSACTION_CENTS ?? '20000',
  10
)
const MAX_OFFLINE_QUEUE_TOTAL_CENTS = parseInt(
  process.env.MAX_OFFLINE_QUEUE_TOTAL_CENTS ?? '200000',
  10
)
const OFFLINE_EXPIRY_HOURS = parseInt(
  process.env.OFFLINE_EXPIRY_HOURS ?? '24',
  10
)

// ---------------------------------------------------------------------------
// Queue Management
// ---------------------------------------------------------------------------

/**
 * Queues a payment for later processing when Valor is unreachable.
 * Enforces risk limits before accepting.
 */
export async function queueOfflinePayment(params: {
  order_id: string
  org_id: string
  location_id: string
  amount_cents: number
  tip_cents: number
  processor_token: string
  card_last_four: string
  card_brand: string
  staff_id: string
  manager_approved?: boolean
}): Promise<QueueResult> {
  const {
    order_id,
    org_id,
    location_id,
    amount_cents,
    tip_cents,
    processor_token,
    card_last_four,
    card_brand,
    staff_id,
    manager_approved,
  } = params

  const totalAmount = amount_cents + tip_cents

  // Risk check: transaction size
  if (totalAmount > MAX_OFFLINE_TRANSACTION_CENTS && !manager_approved) {
    return {
      success: false,
      queued_payment_id: null,
      error: `Offline transaction exceeds floor limit of $${(MAX_OFFLINE_TRANSACTION_CENTS / 100).toFixed(2)}. Manager approval required.`,
      queue_count: 0,
      queue_total_cents: 0,
    }
  }

  const supabase = createAdminClient()

  // Check current queue total
  const { data: existingQueued } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
    .select('total_amount')
    .eq('org_id', org_id)
    .eq('location_id', location_id)
    .eq('status', 'pending')
    .not('processor_response->>offline_queued', 'is', null)

  const queuedPayments = (existingQueued ?? []) as Record<string, unknown>[]
  const currentQueueTotal = queuedPayments.reduce(
    (sum, p) => sum + Math.round(parseFloat(p.total_amount as string) * 100),
    0
  )

  if (currentQueueTotal + totalAmount > MAX_OFFLINE_QUEUE_TOTAL_CENTS) {
    return {
      success: false,
      queued_payment_id: null,
      error: `Total offline queue would exceed $${(MAX_OFFLINE_QUEUE_TOTAL_CENTS / 100).toFixed(2)} limit.`,
      queue_count: queuedPayments.length,
      queue_total_cents: currentQueueTotal,
    }
  }

  // Create the queued payment record
  const paymentId = crypto.randomUUID()
  const { error: insertErr } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
    .insert({
      id: paymentId,
      org_id,
      location_id,
      order_id,
      payment_method: 'credit_card',
      amount: (amount_cents / 100).toFixed(2),
      tip_amount: (tip_cents / 100).toFixed(2),
      total_amount: (totalAmount / 100).toFixed(2),
      status: 'pending',
      card_last_four: card_last_four,
      card_brand: card_brand,
      processed_by: staff_id,
      processor_response: {
        offline_queued: true,
        queued_at: new Date().toISOString(),
        processor_token,
        manager_approved: manager_approved ?? false,
      },
    })

  if (insertErr) {
    return {
      success: false,
      queued_payment_id: null,
      error: 'Failed to queue offline payment',
      queue_count: queuedPayments.length,
      queue_total_cents: currentQueueTotal,
    }
  }

  return {
    success: true,
    queued_payment_id: paymentId,
    queue_count: queuedPayments.length + 1,
    queue_total_cents: currentQueueTotal + totalAmount,
  }
}

/**
 * Processes all queued offline payments for a location.
 * Called when connectivity is restored.
 */
export async function processOfflineQueue(
  org_id: string,
  location_id: string
): Promise<ProcessResult> {
  const supabase = createAdminClient()

  // Get all queued payments, ordered by queue time
  const { data: queuedPayments } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
    .select('*')
    .eq('org_id', org_id)
    .eq('location_id', location_id)
    .eq('status', 'pending')
    .not('processor_response->>offline_queued', 'is', null)
    .order('created_at', { ascending: true })

  if (!queuedPayments || (queuedPayments as unknown[]).length === 0) {
    return { processed: 0, approved: 0, declined: 0, expired: 0, results: [] }
  }

  const valor = getValorClient()
  const results: ProcessResult['results'] = []
  let approved = 0
  let declined = 0
  let expired = 0

  for (const payment of queuedPayments as Record<string, unknown>[]) {
    const processorResponse = payment.processor_response as Record<string, unknown>
    const queuedAt = new Date(processorResponse.queued_at as string)
    const hoursInQueue = (Date.now() - queuedAt.getTime()) / (1000 * 60 * 60)

    // Check expiry
    if (hoursInQueue > OFFLINE_EXPIRY_HOURS) {
      await (supabase.from('payments') as ReturnType<typeof supabase.from>)
        .update({
          status: 'failed',
          processor_response: {
            ...processorResponse,
            expired: true,
            expired_at: new Date().toISOString(),
            hours_in_queue: Math.round(hoursInQueue * 10) / 10,
          },
        })
        .eq('id', payment.id)

      expired++
      results.push({
        id: payment.id as string,
        order_id: payment.order_id as string,
        amount_cents: Math.round(parseFloat(payment.total_amount as string) * 100),
        status: 'expired',
        error_message: `Payment expired after ${Math.round(hoursInQueue)} hours in queue`,
      })
      continue
    }

    // Process via Valor
    try {
      const totalCents = Math.round(parseFloat(payment.total_amount as string) * 100)
      const tipCents = Math.round(parseFloat((payment.tip_amount as string) ?? '0') * 100)
      const amountCents = totalCents - tipCents

      const authResult = await valor.authorize({
        amount_cents: amountCents,
        order_id: payment.order_id as string,
      })

      if (authResult.success) {
        // Capture immediately (offline payments are auth+capture)
        const captureResult = await valor.capture({
          transaction_id: authResult.transaction_id,
          amount_cents: amountCents,
          tip_cents: tipCents,
        })

        if (captureResult.success) {
          await (supabase.from('payments') as ReturnType<typeof supabase.from>)
            .update({
              status: 'captured',
              processor_transaction_id: authResult.transaction_id,
              auth_code: authResult.auth_code,
              card_last_four: authResult.card_last_four,
              card_brand: authResult.card_brand,
              processor_response: {
                ...processorResponse,
                processed: true,
                processed_at: new Date().toISOString(),
                auth_code: authResult.auth_code,
                offline_queued: undefined,
              },
            })
            .eq('id', payment.id)

          // Update order as paid
          await (supabase.from('orders') as ReturnType<typeof supabase.from>)
            .update({
              amount_paid: payment.total_amount,
              balance_due: '0.00',
            })
            .eq('id', payment.order_id)

          approved++
          results.push({
            id: payment.id as string,
            order_id: payment.order_id as string,
            amount_cents: totalCents,
            status: 'approved',
            error_message: null,
          })
        } else {
          // Capture failed after auth — void the auth
          await valor.void({ transaction_id: authResult.transaction_id })
          throw new Error('Capture failed after successful auth')
        }
      } else {
        // Declined
        await (supabase.from('payments') as ReturnType<typeof supabase.from>)
          .update({
            status: 'declined',
            processor_response: {
              ...processorResponse,
              processed: true,
              processed_at: new Date().toISOString(),
              decline_reason: authResult.decline_reason,
            },
          })
          .eq('id', payment.id)

        declined++
        results.push({
          id: payment.id as string,
          order_id: payment.order_id as string,
          amount_cents: totalCents,
          status: 'declined',
          error_message: authResult.decline_reason ?? 'Card declined',
        })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Processing error'
      await (supabase.from('payments') as ReturnType<typeof supabase.from>)
        .update({
          status: 'failed',
          processor_response: {
            ...processorResponse,
            error: errorMessage,
            processed_at: new Date().toISOString(),
          },
        })
        .eq('id', payment.id)

      declined++
      results.push({
        id: payment.id as string,
        order_id: payment.order_id as string,
        amount_cents: Math.round(parseFloat(payment.total_amount as string) * 100),
        status: 'declined',
        error_message: errorMessage,
      })
    }
  }

  return {
    processed: results.length,
    approved,
    declined,
    expired,
    results,
  }
}

/**
 * Gets the current offline payment queue status for a location.
 */
export async function getOfflineQueueStatus(
  org_id: string,
  location_id: string
): Promise<{ count: number; total_cents: number; oldest_queued_at: string | null }> {
  const supabase = createAdminClient()

  const { data: queuedPayments } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
    .select('total_amount, created_at')
    .eq('org_id', org_id)
    .eq('location_id', location_id)
    .eq('status', 'pending')
    .not('processor_response->>offline_queued', 'is', null)
    .order('created_at', { ascending: true })

  if (!queuedPayments || (queuedPayments as unknown[]).length === 0) {
    return { count: 0, total_cents: 0, oldest_queued_at: null }
  }

  const payments = queuedPayments as Record<string, unknown>[]
  const total = payments.reduce(
    (sum, p) => sum + Math.round(parseFloat(p.total_amount as string) * 100),
    0
  )

  return {
    count: payments.length,
    total_cents: total,
    oldest_queued_at: payments[0].created_at as string,
  }
}

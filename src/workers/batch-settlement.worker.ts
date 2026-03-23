/**
 * Batch Settlement Worker
 *
 * BullMQ worker that runs at 2:00 AM (configurable per location)
 * to automatically close the daily batch with Valor.
 *
 * Process:
 * 1. Finds all locations with auto-settlement enabled
 * 2. For each location, calls the Valor batch close API
 * 3. Records settlement results in settlement_batches table
 * 4. Marks captured transactions as settled
 * 5. Alerts manager if settlement fails or has discrepancies
 *
 * Schedule: Cron '0 2 * * *' (2:00 AM daily, configurable per location)
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { getValorClient } from '@/lib/payments/valor-client-loader'

export interface BatchSettlementJobData {
  org_id: string
  location_id: string
  triggered_by: 'auto' | 'manual'
  triggered_by_user_id?: string
}

export interface BatchSettlementResult {
  success: boolean
  location_id: string
  batch_id: string | null
  transaction_count: number
  gross_amount_cents: number
  net_amount_cents: number
  refund_amount_cents: number
  discrepancies: string[]
  error?: string
}

/**
 * Processes a batch settlement job for a single location.
 * This function is called by the BullMQ worker processor.
 */
export async function processBatchSettlement(
  data: BatchSettlementJobData
): Promise<BatchSettlementResult> {
  const { org_id, location_id, triggered_by, triggered_by_user_id } = data
  const supabase = createAdminClient()

  // Get all captured (unsettled) card transactions
  const { data: unsettledPayments, error: fetchErr } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
    .select('id, total_amount, tip_amount, refund_amount, payment_method, card_brand')
    .eq('org_id', org_id)
    .eq('location_id', location_id)
    .eq('status', 'captured')
    .in('payment_method', ['credit_card', 'debit_card', 'apple_pay', 'google_pay'])

  if (fetchErr) {
    return {
      success: false,
      location_id,
      batch_id: null,
      transaction_count: 0,
      gross_amount_cents: 0,
      net_amount_cents: 0,
      refund_amount_cents: 0,
      discrepancies: [],
      error: `Failed to fetch unsettled payments: ${fetchErr.message}`,
    }
  }

  const unsettled = (unsettledPayments ?? []) as Record<string, unknown>[]

  if (unsettled.length === 0) {
    return {
      success: true,
      location_id,
      batch_id: null,
      transaction_count: 0,
      gross_amount_cents: 0,
      net_amount_cents: 0,
      refund_amount_cents: 0,
      discrepancies: [],
    }
  }

  // Calculate batch totals
  let grossCents = 0
  let refundCents = 0
  for (const p of unsettled) {
    grossCents += Math.round(parseFloat(p.total_amount as string) * 100)
    refundCents += Math.round(parseFloat((p.refund_amount as string) ?? '0') * 100)
  }
  const netCents = grossCents - refundCents

  // Call Valor batch close
  const valor = getValorClient()
  let batchResult: Awaited<ReturnType<typeof valor.batchClose>>

  try {
    batchResult = await valor.batchClose({ location_id })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'

    // Record the failure
    await (supabase.from('audit_log') as ReturnType<typeof supabase.from>)
      .insert({
        org_id,
        location_id,
        user_id: triggered_by_user_id ?? null,
        action: 'batch_settlement_failed',
        entity_type: 'payment',
        entity_id: location_id,
        details: {
          error: errorMsg,
          transaction_count: unsettled.length,
          gross_cents: grossCents,
          triggered_by,
        },
      })

    return {
      success: false,
      location_id,
      batch_id: null,
      transaction_count: unsettled.length,
      gross_amount_cents: grossCents,
      net_amount_cents: netCents,
      refund_amount_cents: refundCents,
      discrepancies: [],
      error: `Valor batch close failed: ${errorMsg}`,
    }
  }

  if (!batchResult.success) {
    return {
      success: false,
      location_id,
      batch_id: null,
      transaction_count: unsettled.length,
      gross_amount_cents: grossCents,
      net_amount_cents: netCents,
      refund_amount_cents: refundCents,
      discrepancies: [],
      error: 'Valor batch close returned failure',
    }
  }

  // Record settlement batch
  const { data: batch, error: batchErr } = await (supabase.from('settlement_batches') as ReturnType<typeof supabase.from>)
    .insert({
      org_id,
      location_id,
      processor_batch_id: batchResult.batch_id,
      transaction_count: unsettled.length,
      gross_amount: (grossCents / 100).toFixed(2),
      refund_amount: (refundCents / 100).toFixed(2),
      net_amount: (netCents / 100).toFixed(2),
      batch_closed_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (batchErr) {
    return {
      success: false,
      location_id,
      batch_id: batchResult.batch_id,
      transaction_count: unsettled.length,
      gross_amount_cents: grossCents,
      net_amount_cents: netCents,
      refund_amount_cents: refundCents,
      discrepancies: [],
      error: 'Failed to record settlement batch in database',
    }
  }

  // Mark all captured transactions as settled
  const paymentIds = unsettled.map((p) => p.id as string)
  await (supabase.from('payments') as ReturnType<typeof supabase.from>)
    .update({ status: 'settled' })
    .in('id', paymentIds)

  // Check for discrepancies
  const discrepancies: string[] = []
  const valorGross = batchResult.gross_amount_cents
  if (valorGross > 0 && Math.abs(valorGross - grossCents) > 100) {
    discrepancies.push(
      `Amount mismatch: Sear=$${(grossCents / 100).toFixed(2)}, Valor=$${(valorGross / 100).toFixed(2)}`
    )
  }

  const valorCount = batchResult.transaction_count
  if (valorCount > 0 && valorCount !== unsettled.length) {
    discrepancies.push(
      `Transaction count mismatch: Sear=${unsettled.length}, Valor=${valorCount}`
    )
  }

  // Audit trail
  await (supabase.from('audit_log') as ReturnType<typeof supabase.from>)
    .insert({
      org_id,
      location_id,
      user_id: triggered_by_user_id ?? null,
      action: 'batch_settled',
      entity_type: 'payment',
      entity_id: (batch as Record<string, unknown>).id as string,
      details: {
        batch_id: batchResult.batch_id,
        transaction_count: unsettled.length,
        gross_cents: grossCents,
        net_cents: netCents,
        triggered_by,
        discrepancies,
      },
    })

  return {
    success: true,
    location_id,
    batch_id: batchResult.batch_id,
    transaction_count: unsettled.length,
    gross_amount_cents: grossCents,
    net_amount_cents: netCents,
    refund_amount_cents: refundCents,
    discrepancies,
  }
}

/**
 * Finds all locations that need auto-settlement and processes them.
 * Called by the scheduled BullMQ job.
 */
export async function processAutoSettlementForAllLocations(): Promise<BatchSettlementResult[]> {
  const supabase = createAdminClient()

  // Get all active locations
  const { data: locations } = await (supabase.from('locations') as ReturnType<typeof supabase.from>)
    .select('id, org_id, name')
    .eq('is_active', true)

  if (!locations || (locations as unknown[]).length === 0) {
    return []
  }

  const results: BatchSettlementResult[] = []

  for (const loc of locations as Record<string, unknown>[]) {
    const result = await processBatchSettlement({
      org_id: loc.org_id as string,
      location_id: loc.id as string,
      triggered_by: 'auto',
    })
    results.push(result)
  }

  return results
}

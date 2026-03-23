/**
 * QuickBooks Online Sync Worker
 *
 * BullMQ worker that runs daily at 2:00 AM to sync the previous day's sales
 * to QuickBooks as a journal entry.
 *
 * Queue: qbo-sync
 * Schedule: Cron 0 2 * * * (2:00 AM daily)
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { syncDailySales } from '@/lib/integrations/quickbooks-journal'
import { sendEmail } from '@/lib/integrations/sendgrid-client'

export const QBO_SYNC_QUEUE = 'qbo-sync'

export interface QboSyncJobData {
  /** If provided, sync this specific date. Otherwise, sync yesterday. */
  business_date?: string
  /** If provided, sync only this location. Otherwise, sync all connected locations. */
  location_id?: string
}

export interface QboSyncResult {
  locations_synced: number
  locations_failed: number
  total_revenue: number
  errors: string[]
  duration_ms: number
}

/**
 * Process a QBO sync job.
 */
export async function processQboSyncJob(
  data: QboSyncJobData
): Promise<QboSyncResult> {
  const startTime = Date.now()
  const supabase = createAdminClient()

  // Default to yesterday's business date
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const businessDate = data.business_date ?? yesterday.toISOString().split('T')[0]

  console.log(`[qbo-sync] Starting sync for ${businessDate}`)

  // Get all active QBO connections
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('qbo_connections') as any)
    .select('location_id, company_name, sync_frequency')
    .eq('is_active', true)

  if (data.location_id) {
    query = query.eq('location_id', data.location_id)
  } else {
    // Only auto-sync locations set to daily frequency
    query = query.eq('sync_frequency', 'daily')
  }

  const { data: connections, error: connError } = await query

  if (connError || !connections || connections.length === 0) {
    console.log('[qbo-sync] No active connections found')
    return {
      locations_synced: 0,
      locations_failed: 0,
      total_revenue: 0,
      errors: connError ? [connError.message] : [],
      duration_ms: Date.now() - startTime,
    }
  }

  let synced = 0
  let failed = 0
  let totalRevenue = 0
  const errors: string[] = []

  for (const conn of connections) {
    try {
      const result = await syncDailySales(conn.location_id, businessDate)

      if (result.success) {
        synced++
        totalRevenue += result.totalSynced ?? 0
        console.log(
          `[qbo-sync] Synced ${conn.company_name}: $${result.totalSynced?.toLocaleString() ?? '0'} ` +
          `(JE: ${result.journalEntryId})`
        )
      } else {
        failed++
        errors.push(`${conn.company_name}: ${result.error}`)
        console.error(`[qbo-sync] Failed for ${conn.company_name}: ${result.error}`)

        // Alert owner via email on failure (after all 3 retries exhausted)
        try {
          await alertOwnerOnFailure(conn.location_id, conn.company_name, businessDate, result.error ?? 'Unknown error')
        } catch (alertErr) {
          console.error('[qbo-sync] Failed to send alert email:', alertErr)
        }
      }
    } catch (err) {
      failed++
      const errMsg = err instanceof Error ? err.message : String(err)
      errors.push(`${conn.company_name}: ${errMsg}`)
      console.error(`[qbo-sync] Exception for ${conn.company_name}:`, err)
    }
  }

  const duration = Date.now() - startTime
  console.log(
    `[qbo-sync] Completed in ${duration}ms: ${synced} synced, ${failed} failed, $${totalRevenue.toLocaleString()} total`
  )

  return {
    locations_synced: synced,
    locations_failed: failed,
    total_revenue: totalRevenue,
    errors,
    duration_ms: duration,
  }
}

/**
 * Send an alert email to the owner when QBO sync fails.
 */
async function alertOwnerOnFailure(
  locationId: string,
  companyName: string,
  businessDate: string,
  error: string
): Promise<void> {
  const supabase = createAdminClient()

  // Get org owner email
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: location } = await (supabase.from('locations') as any)
    .select('org_id')
    .eq('id', locationId)
    .single()

  if (!location) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: owner } = await (supabase.from('users') as any)
    .select('email')
    .eq('org_id', location.org_id)
    .eq('role', 'owner')
    .limit(1)
    .maybeSingle()

  if (!owner?.email) return

  await sendEmail({
    locationId,
    to: owner.email,
    subject: `QuickBooks Sync Failed — ${businessDate}`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <div style="background: #FF3B30; padding: 20px 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 18px;">QuickBooks Sync Failed</h1>
        </div>
        <div style="background: white; padding: 24px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #1C1C1E; margin: 0 0 12px;"><strong>Company:</strong> ${companyName}</p>
          <p style="color: #1C1C1E; margin: 0 0 12px;"><strong>Business Date:</strong> ${businessDate}</p>
          <p style="color: #FF3B30; margin: 0 0 12px;"><strong>Error:</strong> ${error}</p>
          <p style="color: #78756D; font-size: 14px;">Please check your QuickBooks connection in Settings > Integrations > QuickBooks and try re-syncing manually.</p>
        </div>
      </div>
    `,
    templateType: 'daily_report',
  })
}

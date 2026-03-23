/**
 * AI Predictions Worker
 *
 * BullMQ worker for daily prediction updates.
 * Schedule: Repeatable cron job at 4:00 AM
 * Queue: ai-predictions-update
 *
 * For each active org+location:
 * 1. Updates yesterday's actual vs predicted (accuracy tracking)
 * 2. Generates/refreshes predictions for the next 7 days
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { generatePredictions } from '@/lib/ai/prediction-engine'

export interface AIPredictionsJobData {
  org_id?: string
  location_id?: string
}

export interface AIPredictionsResult {
  orgs_processed: number
  locations_processed: number
  predictions_updated: number
  errors: string[]
  duration_ms: number
}

/**
 * Process an AI predictions update job.
 */
export async function processAIPredictionsJob(
  data: AIPredictionsJobData
): Promise<AIPredictionsResult> {
  const startTime = Date.now()
  const errors: string[] = []
  let predictionsUpdated = 0
  let locationsProcessed = 0
  let orgsProcessed = 0

  const supabase = createAdminClient()

  console.log('[ai-predictions] Starting daily prediction update')

  try {
    // Get all active orgs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let orgQuery = (supabase.from('organizations') as any)
      .select('id, name')
      .eq('is_active', true)

    if (data.org_id) {
      orgQuery = orgQuery.eq('id', data.org_id)
    }

    const { data: orgs, error: orgError } = await orgQuery

    if (orgError) {
      errors.push(`Failed to fetch orgs: ${orgError.message}`)
      return {
        orgs_processed: 0,
        locations_processed: 0,
        predictions_updated: 0,
        errors,
        duration_ms: Date.now() - startTime,
      }
    }

    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const weekOut = new Date(now)
    weekOut.setDate(weekOut.getDate() + 7)
    const endDate = weekOut.toISOString().split('T')[0]

    // Also update yesterday's actuals
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const org of (orgs as any[] ?? [])) {
      orgsProcessed++

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let locQuery = (supabase.from('locations') as any)
        .select('id, name, timezone')
        .eq('org_id', org.id)
        .eq('is_active', true)

      if (data.location_id) {
        locQuery = locQuery.eq('id', data.location_id)
      }

      const { data: locations, error: locError } = await locQuery

      if (locError) {
        errors.push(`Failed to fetch locations for org ${org.id}: ${locError.message}`)
        continue
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const location of (locations as any[] ?? [])) {
        locationsProcessed++

        try {
          // Check if predictions are enabled
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: settings } = await (supabase.from('ai_settings') as any)
            .select('predict_enabled')
            .eq('org_id', org.id)
            .single()

          if (settings && settings.predict_enabled === false) {
            console.log(`[ai-predictions] Predictions disabled for org ${org.id}, skipping`)
            continue
          }

          // Update yesterday's actuals
          const { data: yesterdayOrders } = await supabase
            .from('orders')
            .select('total_cents, cover_count')
            .eq('org_id', org.id)
            .eq('location_id', location.id)
            .gte('created_at', `${yesterdayStr}T00:00:00Z`)
            .lte('created_at', `${yesterdayStr}T23:59:59Z`)
            .in('status', ['closed', 'completed', 'paid'])

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const yOrders = (yesterdayOrders as any[]) ?? []
          if (yOrders.length > 0) {
            const actualRevenue = yOrders.reduce((s, o) => s + (o.total_cents ?? 0), 0)
            const actualCovers = yOrders.reduce((s, o) => s + (o.cover_count ?? 1), 0)

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from('ai_predictions') as any)
              .update({
                actual_revenue: actualRevenue,
                actual_covers: actualCovers,
              })
              .eq('org_id', org.id)
              .eq('location_id', location.id)
              .eq('prediction_date', yesterdayStr)
          }

          // Generate predictions for next 7 days
          const result = await generatePredictions({
            orgId: org.id,
            locationId: location.id,
            startDate: today,
            endDate: endDate,
            restaurantName: org.name ?? 'Restaurant',
            locationName: location.name ?? 'Main',
          })

          predictionsUpdated += result.predictions.length

          console.log(
            `[ai-predictions] Updated ${result.predictions.length} predictions for ${org.name} / ${location.name}`
          )
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          errors.push(`Failed for ${org.name} / ${location.name}: ${msg}`)
          console.error(
            `[ai-predictions] Error for ${org.name} / ${location.name}:`,
            msg
          )
        }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`Global error: ${msg}`)
  }

  const duration = Date.now() - startTime
  console.log(
    `[ai-predictions] Completed in ${duration}ms: ${orgsProcessed} orgs, ${locationsProcessed} locations, ${predictionsUpdated} predictions, ${errors.length} errors`
  )

  return {
    orgs_processed: orgsProcessed,
    locations_processed: locationsProcessed,
    predictions_updated: predictionsUpdated,
    errors,
    duration_ms: duration,
  }
}

/**
 * BullMQ cron configuration.
 */
export const AI_PREDICTIONS_CRON = '0 4 * * *' // 4:00 AM daily
export const AI_PREDICTIONS_QUEUE = 'ai-predictions-update'

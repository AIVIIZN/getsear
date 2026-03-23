/**
 * AI Insights Worker
 *
 * BullMQ worker for daily insight generation.
 * Schedule: Repeatable cron job at 5:00 AM
 * Queue: ai-insights-generation
 *
 * For each active org+location, runs the insight generator
 * which queries yesterday's data and sends to Claude for analysis.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { generateInsights } from '@/lib/ai/insight-generator'

export interface AIInsightsJobData {
  org_id?: string
  location_id?: string
}

export interface AIInsightsResult {
  orgs_processed: number
  locations_processed: number
  insights_generated: number
  errors: string[]
  duration_ms: number
}

/**
 * Process an AI insights generation job.
 */
export async function processAIInsightsJob(
  data: AIInsightsJobData
): Promise<AIInsightsResult> {
  const startTime = Date.now()
  const errors: string[] = []
  let insightsGenerated = 0
  let locationsProcessed = 0
  let orgsProcessed = 0

  const supabase = createAdminClient()

  console.log('[ai-insights] Starting daily insight generation')

  try {
    // Get all active orgs (or specific one)
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
      return { orgs_processed: 0, locations_processed: 0, insights_generated: 0, errors, duration_ms: Date.now() - startTime }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const org of (orgs as any[] ?? [])) {
      orgsProcessed++

      // Get locations for this org
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
          // Check if AI insights are enabled for this org
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: settings } = await (supabase.from('ai_settings') as any)
            .select('insights_enabled')
            .eq('org_id', org.id)
            .single()

          if (settings && settings.insights_enabled === false) {
            console.log(`[ai-insights] Insights disabled for org ${org.id}, skipping`)
            continue
          }

          const insights = await generateInsights({
            orgId: org.id,
            locationId: location.id,
            restaurantName: org.name ?? 'Restaurant',
            locationName: location.name ?? 'Main',
            timezone: location.timezone ?? 'America/New_York',
          })

          insightsGenerated += insights.length
          console.log(
            `[ai-insights] Generated ${insights.length} insights for ${org.name} / ${location.name}`
          )
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          errors.push(
            `Failed for ${org.name} / ${location.name}: ${msg}`
          )
          console.error(
            `[ai-insights] Error for ${org.name} / ${location.name}:`,
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
    `[ai-insights] Completed in ${duration}ms: ${orgsProcessed} orgs, ${locationsProcessed} locations, ${insightsGenerated} insights, ${errors.length} errors`
  )

  return {
    orgs_processed: orgsProcessed,
    locations_processed: locationsProcessed,
    insights_generated: insightsGenerated,
    errors,
    duration_ms: duration,
  }
}

/**
 * BullMQ cron configuration.
 */
export const AI_INSIGHTS_CRON = '0 5 * * *' // 5:00 AM daily
export const AI_INSIGHTS_QUEUE = 'ai-insights-generation'

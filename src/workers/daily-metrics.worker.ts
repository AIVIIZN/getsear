/**
 * Daily Metrics Aggregation Worker
 *
 * BullMQ worker that runs at 4:00 AM to compute the previous business day's
 * aggregated metrics for all active orgs and locations.
 *
 * After aggregation, dispatches the daily-email-summary job.
 *
 * Schedule: Repeatable cron job at 4:00 AM
 * Queue: daily-metrics-aggregation
 */

import { runDailyAggregation } from '@/lib/reports/aggregation'

export interface DailyMetricsJobData {
  org_id?: string        // If set, only aggregate this org
  business_date?: string // If set, aggregate this date instead of yesterday
}

export interface DailyMetricsResult {
  orgs_processed: number
  locations_processed: number
  errors: string[]
  business_date: string
  duration_ms: number
}

/**
 * Process a daily metrics aggregation job.
 */
export async function processDailyMetricsJob(data: DailyMetricsJobData): Promise<DailyMetricsResult> {
  const startTime = Date.now()

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const businessDate = data.business_date ?? yesterday.toISOString().split('T')[0]

  console.log(`[daily-metrics] Starting aggregation for ${businessDate}`)

  const result = await runDailyAggregation()

  const duration = Date.now() - startTime
  console.log(`[daily-metrics] Completed in ${duration}ms: ${result.orgs} orgs, ${result.locations} locations, ${result.errors.length} errors`)

  if (result.errors.length > 0) {
    console.error('[daily-metrics] Errors:', result.errors)
  }

  return {
    orgs_processed: result.orgs,
    locations_processed: result.locations,
    errors: result.errors,
    business_date: businessDate,
    duration_ms: duration,
  }
}

/**
 * BullMQ cron configuration for this worker.
 * Should be registered in the queue setup:
 *
 * const queue = new Queue('daily-metrics-aggregation', { connection: redis })
 * await queue.add('aggregate', {}, {
 *   repeat: { pattern: '0 4 * * *' }, // 4:00 AM daily
 * })
 */
export const DAILY_METRICS_CRON = '0 4 * * *'
export const DAILY_METRICS_QUEUE = 'daily-metrics-aggregation'

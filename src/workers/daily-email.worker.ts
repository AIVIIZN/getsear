/**
 * Daily Email Summary Worker
 *
 * BullMQ worker that sends daily performance summary emails
 * to configured recipients after the daily metrics aggregation completes.
 *
 * Triggered by the daily-metrics-aggregation worker upon completion.
 * Also can be triggered manually via /api/reports/email-daily.
 *
 * Queue: daily-email-summary
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { sendDailyEmail } from '@/lib/reports/email-templates'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toNumber(val: any): number {
  return Number(val) || 0
}

export interface DailyEmailJobData {
  org_id: string
  business_date: string
}

export interface DailyEmailResult {
  emails_sent: number
  recipients: number
  locations: number
  errors: string[]
  duration_ms: number
}

/**
 * Process a daily email summary job.
 */
export async function processDailyEmailJob(data: DailyEmailJobData): Promise<DailyEmailResult> {
  const startTime = Date.now()
  const supabase = createAdminClient()

  console.log(`[daily-email] Sending daily summary for org ${data.org_id} date ${data.business_date}`)

  // Get org details
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: org } = await (supabase.from('organizations') as any)
    .select('name, owner_email, settings')
    .eq('id', data.org_id)
    .single()

  if (!org) {
    return { emails_sent: 0, recipients: 0, locations: 0, errors: ['Org not found'], duration_ms: Date.now() - startTime }
  }

  // Get configured recipients
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: users } = await (supabase.from('users') as any)
    .select('email, role, settings')
    .eq('org_id', data.org_id)
    .in('role', ['owner', 'admin'])
    .eq('is_active', true)

  const recipients = (users ?? [])
    .filter((u: { email: string | null; settings: { receive_daily_report?: boolean } }) =>
      u.email && (u.settings?.receive_daily_report !== false)
    )
    .map((u: { email: string }) => u.email)

  if (org.owner_email && !recipients.includes(org.owner_email)) {
    recipients.push(org.owner_email)
  }

  if (recipients.length === 0) {
    return { emails_sent: 0, recipients: 0, locations: 0, errors: ['No recipients configured'], duration_ms: Date.now() - startTime }
  }

  // Get locations with their daily metrics
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: metrics } = await (supabase.from('daily_metrics') as any)
    .select('location_id, total_revenue, order_count, average_check, labor_percentage, food_cost_percentage, location:locations(name)')
    .eq('org_id', data.org_id)
    .eq('metric_date', data.business_date)

  const errors: string[] = []
  let emailsSent = 0

  for (const metric of (metrics ?? [])) {
    try {
      // Get previous week comparison
      const prevDate = new Date(data.business_date)
      prevDate.setDate(prevDate.getDate() - 7)
      const prevDateStr = prevDate.toISOString().split('T')[0]

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: prevMetric } = await (supabase.from('daily_metrics') as any)
        .select('total_revenue')
        .eq('location_id', metric.location_id)
        .eq('metric_date', prevDateStr)
        .maybeSingle()

      const prevRevenue = toNumber(prevMetric?.total_revenue)
      const currentRevenue = toNumber(metric.total_revenue)
      const changePct = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0

      const result = await sendDailyEmail(recipients, {
        locationName: metric.location?.name ?? 'Location',
        businessDate: data.business_date,
        totalRevenue: currentRevenue,
        orderCount: toNumber(metric.order_count),
        averageCheck: toNumber(metric.average_check),
        laborPct: toNumber(metric.labor_percentage),
        foodCostPct: toNumber(metric.food_cost_percentage),
        prevWeekRevenue: prevRevenue,
        revenueChangePct: Math.round(changePct * 10) / 10,
        appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'https://getsear.com',
      })

      if (result.success) {
        emailsSent += 1
      } else {
        errors.push(`${metric.location?.name}: ${result.error}`)
      }
    } catch (err) {
      errors.push(`${metric.location_id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const duration = Date.now() - startTime
  console.log(`[daily-email] Completed in ${duration}ms: ${emailsSent} emails sent to ${recipients.length} recipients`)

  return {
    emails_sent: emailsSent,
    recipients: recipients.length,
    locations: (metrics ?? []).length,
    errors,
    duration_ms: duration,
  }
}

export const DAILY_EMAIL_QUEUE = 'daily-email-summary'

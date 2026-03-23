/**
 * AI Cost Tracker
 *
 * Tracks token usage and estimated costs per query.
 * Stores in the ai_usage table for billing visibility.
 */

import { createAdminClient } from '@/lib/supabase/admin'

export interface UsageRecord {
  orgId: string
  userId: string
  inputTokens: number
  outputTokens: number
  estimatedCost: number
  queryType: 'ask' | 'insights' | 'predict'
}

/**
 * Track token usage for a query. Fire-and-forget.
 */
export async function trackUsage(record: UsageRecord): Promise<void> {
  try {
    const supabase = createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('ai_usage') as any).insert({
      org_id: record.orgId,
      user_id: record.userId,
      tokens_in: record.inputTokens,
      tokens_out: record.outputTokens,
      estimated_cost: record.estimatedCost,
      query_type: record.queryType,
    })
  } catch (err) {
    // Non-blocking — log but don't throw
    console.error('[cost-tracker] Failed to track usage:', err)
  }
}

export interface UsageSummary {
  today: { queries: number; tokenIn: number; tokenOut: number; cost: number }
  thisMonth: { queries: number; tokenIn: number; tokenOut: number; cost: number }
  byType: Array<{ type: string; queries: number; cost: number }>
  projectedMonthlyCost: number
}

/**
 * Get usage summary for an organization.
 */
export async function getUsageSummary(orgId: string): Promise<UsageSummary> {
  const supabase = createAdminClient()

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // Today's usage
  const { data: todayData } = await supabase
    .from('ai_usage')
    .select('tokens_in, tokens_out, estimated_cost, query_type')
    .eq('org_id', orgId)
    .gte('created_at', todayStart)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const todayRecords = (todayData as any[]) ?? []
  const today = {
    queries: todayRecords.length,
    tokenIn: todayRecords.reduce((s, r) => s + (r.tokens_in ?? 0), 0),
    tokenOut: todayRecords.reduce((s, r) => s + (r.tokens_out ?? 0), 0),
    cost: todayRecords.reduce((s, r) => s + parseFloat(r.estimated_cost ?? '0'), 0),
  }

  // Month's usage
  const { data: monthData } = await supabase
    .from('ai_usage')
    .select('tokens_in, tokens_out, estimated_cost, query_type')
    .eq('org_id', orgId)
    .gte('created_at', monthStart)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const monthRecords = (monthData as any[]) ?? []
  const thisMonth = {
    queries: monthRecords.length,
    tokenIn: monthRecords.reduce((s, r) => s + (r.tokens_in ?? 0), 0),
    tokenOut: monthRecords.reduce((s, r) => s + (r.tokens_out ?? 0), 0),
    cost: monthRecords.reduce((s, r) => s + parseFloat(r.estimated_cost ?? '0'), 0),
  }

  // By type
  const typeMap = new Map<string, { queries: number; cost: number }>()
  for (const r of monthRecords) {
    const type = r.query_type ?? 'unknown'
    const existing = typeMap.get(type) ?? { queries: 0, cost: 0 }
    existing.queries += 1
    existing.cost += parseFloat(r.estimated_cost ?? '0')
    typeMap.set(type, existing)
  }

  // Project monthly cost based on daily average
  const dayOfMonth = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const dailyAvg = dayOfMonth > 0 ? thisMonth.cost / dayOfMonth : 0
  const projectedMonthlyCost = dailyAvg * daysInMonth

  return {
    today,
    thisMonth,
    byType: Array.from(typeMap.entries()).map(([type, d]) => ({
      type,
      ...d,
    })),
    projectedMonthlyCost,
  }
}

/**
 * Check if a user has exceeded their daily query limit.
 */
export async function checkRateLimit(
  orgId: string,
  userId: string,
  maxQueriesPerDay: number = 50
): Promise<{ allowed: boolean; remaining: number; used: number }> {
  const supabase = createAdminClient()

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

  const { count } = await supabase
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .eq('query_type', 'ask')
    .gte('created_at', todayStart)

  const used = count ?? 0
  return {
    allowed: used < maxQueriesPerDay,
    remaining: Math.max(0, maxQueriesPerDay - used),
    used,
  }
}

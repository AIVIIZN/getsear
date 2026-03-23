/**
 * Insight Generator
 *
 * Queries yesterday's data, compares to historical baselines,
 * sends structured data to Claude for insight generation,
 * and stores the results in ai_insights.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { sendMessage } from './claude-client'
import { getInsightsSystemPrompt } from './system-prompts'
import {
  querySalesData,
  queryLaborData,
  queryMenuPerformance,
  queryFoodCostData,
  querySpeedOfService,
  queryVoidsComps,
} from './query-builders'

export interface GeneratedInsight {
  category: string
  priority: 'high' | 'medium' | 'low'
  title: string
  summary: string
  details: string
  metric_value: string
  comparison_text: string
}

/**
 * Generate daily insights for a location.
 */
export async function generateInsights(params: {
  orgId: string
  locationId: string
  restaurantName: string
  locationName: string
  timezone: string
}): Promise<GeneratedInsight[]> {
  const { orgId, locationId, restaurantName, locationName, timezone } = params
  const supabase = createAdminClient()
  const scope = { orgId, locationId }

  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  // Same day last week
  const lastWeek = new Date(yesterday)
  lastWeek.setDate(lastWeek.getDate() - 7)
  const lastWeekStr = lastWeek.toISOString().split('T')[0]

  // 4 weeks ago (for rolling average)
  const fourWeeksAgo = new Date(yesterday)
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)
  const fourWeeksAgoStr = fourWeeksAgo.toISOString().split('T')[0]

  console.log(`[insight-generator] Generating insights for ${locationName} (${yesterdayStr})`)

  // Gather data in parallel
  const [
    yesterdaySales,
    lastWeekSales,
    rollingAvgSales,
    yesterdayLabor,
    menuPerformance,
    foodCost,
    speedOfService,
    voidsComps,
  ] = await Promise.all([
    querySalesData(supabase, scope, { startDate: yesterdayStr, endDate: yesterdayStr }, {}),
    querySalesData(supabase, scope, { startDate: lastWeekStr, endDate: lastWeekStr }, {}),
    querySalesData(supabase, scope, { startDate: fourWeeksAgoStr, endDate: yesterdayStr }, { groupBy: 'day' }),
    queryLaborData(supabase, scope, { startDate: yesterdayStr, endDate: yesterdayStr }, { groupBy: 'role' }),
    queryMenuPerformance(supabase, scope, { startDate: fourWeeksAgoStr, endDate: yesterdayStr }, { sortBy: 'margin_pct', sortDir: 'asc', limit: 20 }),
    queryFoodCostData(supabase, scope, { startDate: yesterdayStr, endDate: yesterdayStr }, {}),
    querySpeedOfService(supabase, scope, { startDate: yesterdayStr, endDate: yesterdayStr }, {}),
    queryVoidsComps(supabase, scope, { startDate: yesterdayStr, endDate: yesterdayStr }, { groupBy: 'employee' }),
  ])

  // Build data package for Claude
  const dataPackage = {
    date: yesterdayStr,
    yesterday_sales: yesterdaySales.data,
    same_day_last_week_sales: lastWeekSales.data,
    rolling_4_week_sales: rollingAvgSales.data,
    yesterday_labor: yesterdayLabor.data,
    menu_performance_4_weeks: menuPerformance.data,
    food_cost: foodCost.data,
    speed_of_service: speedOfService.data,
    voids_comps: voidsComps.data,
  }

  // Check for existing insights to avoid duplicates
  const { data: recentInsights } = await supabase
    .from('ai_insights')
    .select('title, category')
    .eq('org_id', orgId)
    .eq('location_id', locationId)
    .gte('generated_at', new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString())
    .limit(20)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recentTitles = (recentInsights as any[] ?? []).map((i) => i.title)

  const systemPrompt = getInsightsSystemPrompt({
    restaurantName,
    locationName,
    timezone,
    currentDate: now.toISOString().split('T')[0],
  })

  const userMessage = `Here is the data for ${yesterdayStr}. Generate 3-5 actionable insights.

${recentTitles.length > 0 ? `IMPORTANT: Do NOT repeat these recent insights (already generated): ${recentTitles.join(', ')}` : ''}

DATA:
${JSON.stringify(dataPackage, null, 2)}`

  try {
    const response = await sendMessage({
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      orgId,
      userId: 'system',
      queryType: 'insights',
    })

    // Parse the JSON from Claude's response
    const jsonMatch = response.text.match(/```json\s*([\s\S]*?)```/)
    if (!jsonMatch) {
      console.error('[insight-generator] No JSON found in Claude response')
      return []
    }

    const insights: GeneratedInsight[] = JSON.parse(jsonMatch[1])

    // Validate and store insights
    const validInsights: GeneratedInsight[] = []
    for (const insight of insights) {
      if (!insight.category || !insight.title || !insight.summary) continue
      if (recentTitles.includes(insight.title)) continue // Dedup

      validInsights.push(insight)

      // Store in database
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('ai_insights') as any).insert({
        org_id: orgId,
        location_id: locationId,
        category: insight.category,
        priority: insight.priority ?? 'medium',
        title: insight.title,
        summary: insight.summary,
        details: insight.details ?? '',
        metric_value: insight.metric_value ?? '',
        comparison_text: insight.comparison_text ?? '',
        is_dismissed: false,
        feedback: null,
        generated_at: now.toISOString(),
      })
    }

    console.log(`[insight-generator] Generated ${validInsights.length} insights for ${locationName}`)
    return validInsights
  } catch (err) {
    console.error('[insight-generator] Failed to generate insights:', err)
    return []
  }
}

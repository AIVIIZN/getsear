/**
 * Prediction Engine
 *
 * Generates demand forecasts using weighted 13-week historical averages.
 * Optionally enhanced with Claude for trend detection and adjustment.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { sendMessage } from './claude-client'
import { getPredictSystemPrompt } from './system-prompts'

export interface DayPrediction {
  date: string
  dayOfWeek: string
  predictedRevenueCents: number
  predictedCovers: number
  predictedLaborHours: number
  confidence: number
  actualRevenueCents: number | null
  actualCovers: number | null
}

export interface PredictionResult {
  predictions: DayPrediction[]
  accuracy: { days: number; avgRevenueAccuracy: number; avgCoverAccuracy: number } | null
  minimumDataMet: boolean
  weeksOfData: number
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * Weighted average: more recent weeks get higher weight.
 * Weights: week 1 (most recent) = 2.0, week 13 (oldest) = 0.5
 */
function weightedAverage(values: number[]): number {
  if (values.length === 0) return 0
  const maxWeight = 2.0
  const minWeight = 0.5
  const step = values.length > 1 ? (maxWeight - minWeight) / (values.length - 1) : 0

  let weightedSum = 0
  let totalWeight = 0
  for (let i = 0; i < values.length; i++) {
    const weight = maxWeight - step * i // Most recent first
    weightedSum += values[i] * weight
    totalWeight += weight
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0
}

/**
 * Generate predictions for a date range.
 */
export async function generatePredictions(params: {
  orgId: string
  locationId: string
  startDate: string
  endDate: string
  restaurantName: string
  locationName: string
  useAIEnhancement?: boolean
}): Promise<PredictionResult> {
  const { orgId, locationId, startDate, endDate, restaurantName, locationName } = params
  const supabase = createAdminClient()

  // Check how much historical data we have
  const { data: oldestOrder } = await supabase
    .from('orders')
    .select('created_at')
    .eq('org_id', orgId)
    .eq('location_id', locationId)
    .in('status', ['closed', 'completed', 'paid'])
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  const oldestDate = oldestOrder
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? new Date((oldestOrder as any).created_at)
    : new Date()

  const weeksOfData = Math.floor(
    (new Date().getTime() - oldestDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
  )

  if (weeksOfData < 4) {
    return {
      predictions: [],
      accuracy: null,
      minimumDataMet: false,
      weeksOfData,
    }
  }

  // Generate predictions for each day in range
  const start = new Date(startDate)
  const end = new Date(endDate)
  const predictions: DayPrediction[] = []

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0]
    const dayOfWeek = d.getDay()

    // Get same-day-of-week data for past 13 weeks (or as many as available)
    const historicalRevenues: number[] = []
    const historicalCovers: number[] = []
    const lookbackWeeks = Math.min(13, weeksOfData)

    for (let w = 1; w <= lookbackWeeks; w++) {
      const pastDate = new Date(d)
      pastDate.setDate(pastDate.getDate() - w * 7)
      const pastDateStr = pastDate.toISOString().split('T')[0]

      const { data: dayOrders } = await supabase
        .from('orders')
        .select('total_cents, cover_count')
        .eq('org_id', orgId)
        .eq('location_id', locationId)
        .gte('created_at', `${pastDateStr}T00:00:00Z`)
        .lte('created_at', `${pastDateStr}T23:59:59Z`)
        .in('status', ['closed', 'completed', 'paid'])

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orders = (dayOrders as any[]) ?? []
      if (orders.length > 0) {
        const dayRevenue = orders.reduce((s, o) => s + (o.total_cents ?? 0), 0)
        const dayCovers = orders.reduce((s, o) => s + (o.cover_count ?? 1), 0)
        historicalRevenues.push(dayRevenue)
        historicalCovers.push(dayCovers)
      }
    }

    const predictedRevenue = Math.round(weightedAverage(historicalRevenues))
    const predictedCovers = Math.round(weightedAverage(historicalCovers))

    // Calculate confidence based on data consistency
    let confidence = 0.7 // Base
    if (historicalRevenues.length >= 8) confidence += 0.1
    if (historicalRevenues.length >= 13) confidence += 0.1

    // Lower confidence if high variance
    if (historicalRevenues.length > 2) {
      const avg = historicalRevenues.reduce((a, b) => a + b, 0) / historicalRevenues.length
      const variance =
        historicalRevenues.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) /
        historicalRevenues.length
      const cv = avg > 0 ? Math.sqrt(variance) / avg : 0 // Coefficient of variation
      if (cv > 0.3) confidence -= 0.15
      else if (cv > 0.2) confidence -= 0.05
    }

    confidence = Math.max(0.3, Math.min(1.0, confidence))

    // Estimate labor hours: configurable covers-per-labor-hour ratio
    const coversPerLaborHour = 8 // Default: 8 covers per labor hour
    const predictedLaborHours = Math.ceil(predictedCovers / coversPerLaborHour)

    // Check for actuals (if this day has already passed)
    let actualRevenue: number | null = null
    let actualCovers: number | null = null
    const today = new Date().toISOString().split('T')[0]
    if (dateStr < today) {
      const { data: actualOrders } = await supabase
        .from('orders')
        .select('total_cents, cover_count')
        .eq('org_id', orgId)
        .eq('location_id', locationId)
        .gte('created_at', `${dateStr}T00:00:00Z`)
        .lte('created_at', `${dateStr}T23:59:59Z`)
        .in('status', ['closed', 'completed', 'paid'])

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const actuals = (actualOrders as any[]) ?? []
      if (actuals.length > 0) {
        actualRevenue = actuals.reduce((s, o) => s + (o.total_cents ?? 0), 0)
        actualCovers = actuals.reduce((s, o) => s + (o.cover_count ?? 1), 0)
      }
    }

    predictions.push({
      date: dateStr,
      dayOfWeek: DAY_NAMES[dayOfWeek],
      predictedRevenueCents: predictedRevenue,
      predictedCovers,
      predictedLaborHours,
      confidence,
      actualRevenueCents: actualRevenue,
      actualCovers,
    })
  }

  // AI enhancement (optional, for trend detection)
  if (params.useAIEnhancement && predictions.length > 0 && predictions[0].predictedRevenueCents > 0) {
    try {
      const systemPrompt = getPredictSystemPrompt({
        restaurantName,
        locationName,
        currentDate: new Date().toISOString().split('T')[0],
      })

      const historicalSummary = predictions.map((p) => ({
        date: p.date,
        dayOfWeek: p.dayOfWeek,
        statisticalForecast: p.predictedRevenueCents,
        confidence: p.confidence,
      }))

      const response = await sendMessage({
        systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Here are the statistical forecasts. Review and suggest adjustments if appropriate:\n\n${JSON.stringify(historicalSummary, null, 2)}`,
          },
        ],
        orgId,
        userId: 'system',
        queryType: 'predict',
      })

      // Parse adjustment
      const jsonMatch = response.text.match(/```json\s*([\s\S]*?)```/)
      if (jsonMatch) {
        const adjustment = JSON.parse(jsonMatch[1])
        const factor = typeof adjustment.adjustment_factor === 'number'
          ? Math.max(0.8, Math.min(1.2, adjustment.adjustment_factor))
          : 1.0
        const aiConfidence = typeof adjustment.confidence === 'number'
          ? adjustment.confidence
          : 0.7

        if (factor !== 1.0) {
          for (const p of predictions) {
            p.predictedRevenueCents = Math.round(p.predictedRevenueCents * factor)
            p.predictedCovers = Math.round(p.predictedCovers * factor)
            p.confidence = (p.confidence + aiConfidence) / 2
          }
        }
      }
    } catch (err) {
      console.warn('[prediction-engine] AI enhancement failed, using statistical forecast:', err)
    }
  }

  // Calculate accuracy for completed days
  const completedPredictions = predictions.filter(
    (p) => p.actualRevenueCents !== null && p.predictedRevenueCents > 0
  )
  let accuracy: PredictionResult['accuracy'] = null

  if (completedPredictions.length > 0) {
    const revenueAccuracies = completedPredictions.map((p) => {
      const diff = Math.abs((p.actualRevenueCents ?? 0) - p.predictedRevenueCents)
      return 1 - diff / Math.max(p.predictedRevenueCents, 1)
    })
    const coverAccuracies = completedPredictions.map((p) => {
      const diff = Math.abs((p.actualCovers ?? 0) - p.predictedCovers)
      return 1 - diff / Math.max(p.predictedCovers, 1)
    })

    accuracy = {
      days: completedPredictions.length,
      avgRevenueAccuracy: Math.max(0, revenueAccuracies.reduce((a, b) => a + b, 0) / revenueAccuracies.length * 100),
      avgCoverAccuracy: Math.max(0, coverAccuracies.reduce((a, b) => a + b, 0) / coverAccuracies.length * 100),
    }
  }

  // Store predictions in database
  for (const p of predictions) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('ai_predictions') as any).upsert(
        {
          org_id: orgId,
          location_id: locationId,
          prediction_date: p.date,
          predicted_revenue: p.predictedRevenueCents,
          predicted_covers: p.predictedCovers,
          predicted_labor_hours: p.predictedLaborHours,
          actual_revenue: p.actualRevenueCents,
          actual_covers: p.actualCovers,
          confidence: p.confidence,
        },
        { onConflict: 'org_id,location_id,prediction_date' }
      )
    } catch {
      // Ignore upsert conflicts
    }
  }

  return {
    predictions,
    accuracy,
    minimumDataMet: true,
    weeksOfData,
  }
}

/**
 * Get prediction accuracy for a date range.
 */
export async function getPredictionAccuracy(params: {
  orgId: string
  locationId: string
  startDate: string
  endDate: string
}): Promise<{
  days: number
  avgRevenueAccuracy: number
  avgCoverAccuracy: number
  byDay: Array<{
    date: string
    predictedRevenue: number
    actualRevenue: number
    revenueAccuracy: number
    predictedCovers: number
    actualCovers: number
    coverAccuracy: number
  }>
}> {
  const supabase = createAdminClient()

  const { data: predictions } = await supabase
    .from('ai_predictions')
    .select('*')
    .eq('org_id', params.orgId)
    .eq('location_id', params.locationId)
    .gte('prediction_date', params.startDate)
    .lte('prediction_date', params.endDate)
    .not('actual_revenue', 'is', null)
    .order('prediction_date')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (predictions as any[]) ?? []

  const byDay = rows.map((r) => {
    const revAccuracy = r.predicted_revenue > 0
      ? Math.max(0, (1 - Math.abs(r.actual_revenue - r.predicted_revenue) / r.predicted_revenue) * 100)
      : 0
    const covAccuracy = r.predicted_covers > 0
      ? Math.max(0, (1 - Math.abs(r.actual_covers - r.predicted_covers) / r.predicted_covers) * 100)
      : 0
    return {
      date: r.prediction_date,
      predictedRevenue: r.predicted_revenue,
      actualRevenue: r.actual_revenue,
      revenueAccuracy: Math.round(revAccuracy * 10) / 10,
      predictedCovers: r.predicted_covers,
      actualCovers: r.actual_covers,
      coverAccuracy: Math.round(covAccuracy * 10) / 10,
    }
  })

  const avgRevAccuracy = byDay.length > 0
    ? byDay.reduce((s, d) => s + d.revenueAccuracy, 0) / byDay.length
    : 0
  const avgCovAccuracy = byDay.length > 0
    ? byDay.reduce((s, d) => s + d.coverAccuracy, 0) / byDay.length
    : 0

  return {
    days: byDay.length,
    avgRevenueAccuracy: Math.round(avgRevAccuracy * 10) / 10,
    avgCoverAccuracy: Math.round(avgCovAccuracy * 10) / 10,
    byDay,
  }
}

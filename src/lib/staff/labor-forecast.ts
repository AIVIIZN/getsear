/**
 * Labor Cost Forecasting
 *
 * Calculates projected labor cost from schedule x rates vs projected revenue.
 * Revenue projection uses same-week-last-year data adjusted by trailing 4-week trend.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScheduledShift {
  userId: string
  role: string
  startTime: Date
  endTime: Date
  hourlyRateCents: number
}

export interface DailyRevenue {
  date: string
  revenueCents: number
}

export interface LaborForecastResult {
  /** Total scheduled hours for the period */
  totalScheduledHours: number
  /** Projected labor cost in cents */
  projectedLaborCostCents: number
  /** Projected revenue in cents (from historical data) */
  projectedRevenueCents: number
  /** Labor cost as percentage of projected revenue */
  laborPercentage: number
  /** Color threshold: 'green' < 28%, 'amber' 28-32%, 'red' > 32% */
  thresholdColor: 'green' | 'amber' | 'red'
  /** Per-day breakdown */
  dailyBreakdown: DailyForecast[]
}

export interface DailyForecast {
  date: string
  dayOfWeek: string
  scheduledHours: number
  laborCostCents: number
  projectedRevenueCents: number
  laborPercentage: number
  thresholdColor: 'green' | 'amber' | 'red'
}

export interface ForecastThresholds {
  greenMax: number  // default 28
  amberMax: number  // default 32
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getShiftHours(shift: ScheduledShift): number {
  return (shift.endTime.getTime() - shift.startTime.getTime()) / 3600000
}

function getShiftCost(shift: ScheduledShift): number {
  const hours = getShiftHours(shift)
  return Math.round(hours * shift.hourlyRateCents)
}

function getDateKey(date: Date): string {
  return date.toISOString().split('T')[0]
}

function getDayOfWeek(dateStr: string): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return days[new Date(dateStr + 'T12:00:00').getDay()]
}

function getThresholdColor(
  percentage: number,
  thresholds: ForecastThresholds
): 'green' | 'amber' | 'red' {
  if (percentage < thresholds.greenMax) return 'green'
  if (percentage <= thresholds.amberMax) return 'amber'
  return 'red'
}

// ---------------------------------------------------------------------------
// Revenue projection
// ---------------------------------------------------------------------------

/**
 * Project revenue for a week based on same-week-last-year data
 * adjusted by a trailing 4-week trend multiplier.
 */
export function projectRevenue(
  sameWeekLastYear: DailyRevenue[],
  trailing4WeekCurrent: DailyRevenue[],
  trailing4WeekPrior: DailyRevenue[]
): number {
  const lastYearTotal = sameWeekLastYear.reduce((s, d) => s + d.revenueCents, 0)

  if (lastYearTotal === 0) {
    // No historical data — use trailing 4-week average as estimate
    const currentTotal = trailing4WeekCurrent.reduce((s, d) => s + d.revenueCents, 0)
    return currentTotal > 0 ? Math.round(currentTotal / 4) : 0
  }

  // Calculate trend multiplier: average of recent 4 weeks / same 4 weeks last year
  const currentTotal = trailing4WeekCurrent.reduce((s, d) => s + d.revenueCents, 0)
  const priorTotal = trailing4WeekPrior.reduce((s, d) => s + d.revenueCents, 0)

  const trendMultiplier = priorTotal > 0 ? currentTotal / priorTotal : 1.0

  return Math.round(lastYearTotal * trendMultiplier)
}

// ---------------------------------------------------------------------------
// Main: calculate labor forecast
// ---------------------------------------------------------------------------

export function calculateLaborForecast(
  shifts: ScheduledShift[],
  projectedRevenueCents: number,
  dates: string[],
  thresholds: ForecastThresholds = { greenMax: 28, amberMax: 32 }
): LaborForecastResult {
  // Calculate totals
  let totalHours = 0
  let totalCost = 0

  for (const shift of shifts) {
    totalHours += getShiftHours(shift)
    totalCost += getShiftCost(shift)
  }

  const laborPercentage =
    projectedRevenueCents > 0 ? (totalCost / projectedRevenueCents) * 100 : 0

  // Per-day breakdown
  const dailyBreakdown: DailyForecast[] = dates.map((date) => {
    const dayShifts = shifts.filter((s) => getDateKey(s.startTime) === date)
    const dayHours = dayShifts.reduce((s, sh) => s + getShiftHours(sh), 0)
    const dayCost = dayShifts.reduce((s, sh) => s + getShiftCost(sh), 0)
    // Distribute projected revenue evenly across days (simple approximation)
    const dayRevenue = dates.length > 0 ? Math.round(projectedRevenueCents / dates.length) : 0
    const dayPct = dayRevenue > 0 ? (dayCost / dayRevenue) * 100 : 0

    return {
      date,
      dayOfWeek: getDayOfWeek(date),
      scheduledHours: dayHours,
      laborCostCents: dayCost,
      projectedRevenueCents: dayRevenue,
      laborPercentage: dayPct,
      thresholdColor: getThresholdColor(dayPct, thresholds),
    }
  })

  return {
    totalScheduledHours: totalHours,
    projectedLaborCostCents: totalCost,
    projectedRevenueCents,
    laborPercentage,
    thresholdColor: getThresholdColor(laborPercentage, thresholds),
    dailyBreakdown,
  }
}

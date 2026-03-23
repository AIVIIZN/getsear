/**
 * Overtime Calculation Engine
 *
 * Supports:
 * - Federal: OT after 40 hours/week at 1.5x
 * - California: OT after 8 hrs/day at 1.5x, after 12 hrs/day at 2x, 40 hrs/week, 7th consecutive day rules
 * - Colorado: OT after 12 hrs/day or 40 hrs/week
 * - Custom: configurable daily and weekly thresholds
 *
 * All money values are in integer cents. Hour values are decimal numbers.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OvertimeRule = 'federal' | 'california' | 'colorado' | 'custom'

export interface OvertimeConfig {
  rule: OvertimeRule
  /** Daily OT threshold in hours (only for custom rule) */
  dailyThresholdHours: number
  /** Weekly OT threshold in hours */
  weeklyThresholdHours: number
  /** Daily OT rate multiplier (e.g. 1.5) */
  dailyRateMultiplier: number
  /** Weekly OT rate multiplier (e.g. 1.5) */
  weeklyRateMultiplier: number
}

export interface TimeEntry {
  id: string
  userId: string
  locationId: string
  clockIn: Date
  clockOut: Date | null
  unpaidBreakMinutes: number
}

export interface OvertimeResult {
  regularHours: number
  overtimeHours: number
  doubleTimeHours: number
  regularRateMultiplier: number
  overtimeRateMultiplier: number
  doubleTimeRateMultiplier: number
  /** Whether the employee is approaching weekly OT threshold */
  isApproachingWeeklyOt: boolean
  /** Whether the employee is approaching daily OT threshold */
  isApproachingDailyOt: boolean
  /** Whether currently in overtime */
  isInOvertime: boolean
  /** Hours remaining until weekly OT */
  hoursUntilWeeklyOt: number
  /** Hours remaining until daily OT */
  hoursUntilDailyOt: number
  /** Total hours worked this week across all locations */
  weeklyTotalHours: number
  /** Total hours worked today */
  dailyTotalHours: number
  /** Consecutive days worked (for CA 7th day rule) */
  consecutiveDays: number
}

// ---------------------------------------------------------------------------
// Default configs per rule
// ---------------------------------------------------------------------------

const DEFAULT_CONFIGS: Record<OvertimeRule, OvertimeConfig> = {
  federal: {
    rule: 'federal',
    dailyThresholdHours: Infinity,
    weeklyThresholdHours: 40,
    dailyRateMultiplier: 1.5,
    weeklyRateMultiplier: 1.5,
  },
  california: {
    rule: 'california',
    dailyThresholdHours: 8,
    weeklyThresholdHours: 40,
    dailyRateMultiplier: 1.5,
    weeklyRateMultiplier: 1.5,
  },
  colorado: {
    rule: 'colorado',
    dailyThresholdHours: 12,
    weeklyThresholdHours: 40,
    dailyRateMultiplier: 1.5,
    weeklyRateMultiplier: 1.5,
  },
  custom: {
    rule: 'custom',
    dailyThresholdHours: 8,
    weeklyThresholdHours: 40,
    dailyRateMultiplier: 1.5,
    weeklyRateMultiplier: 1.5,
  },
}

export function getDefaultConfig(rule: OvertimeRule): OvertimeConfig {
  return { ...DEFAULT_CONFIGS[rule] }
}

// ---------------------------------------------------------------------------
// Helper: calculate worked hours from a time entry
// ---------------------------------------------------------------------------

function getWorkedHours(entry: TimeEntry, asOfDate?: Date): number {
  const clockOut = entry.clockOut ?? asOfDate ?? new Date()
  const totalMinutes = (clockOut.getTime() - entry.clockIn.getTime()) / 60000
  const workedMinutes = Math.max(0, totalMinutes - entry.unpaidBreakMinutes)
  return workedMinutes / 60
}

// ---------------------------------------------------------------------------
// Helper: get entries for a specific day
// ---------------------------------------------------------------------------

function getEntriesForDay(entries: TimeEntry[], date: Date): TimeEntry[] {
  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(date)
  dayEnd.setHours(23, 59, 59, 999)

  return entries.filter((e) => {
    const clockIn = e.clockIn
    return clockIn >= dayStart && clockIn <= dayEnd
  })
}

// ---------------------------------------------------------------------------
// Helper: get the start of the work week (Monday by default)
// ---------------------------------------------------------------------------

function getWeekStart(date: Date, weekStartDay: number = 1): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const currentDay = d.getDay()
  const diff = (currentDay - weekStartDay + 7) % 7
  d.setDate(d.getDate() - diff)
  return d
}

// ---------------------------------------------------------------------------
// Helper: count consecutive work days ending on the given date
// ---------------------------------------------------------------------------

function countConsecutiveDays(
  entries: TimeEntry[],
  date: Date,
  weekStartDay: number = 1
): number {
  const weekStart = getWeekStart(date, weekStartDay)
  let consecutiveDays = 0
  const checkDate = new Date(date)
  checkDate.setHours(0, 0, 0, 0)

  while (checkDate >= weekStart) {
    const dayEntries = getEntriesForDay(entries, checkDate)
    if (dayEntries.length > 0) {
      consecutiveDays++
    } else {
      break
    }
    checkDate.setDate(checkDate.getDate() - 1)
  }

  return consecutiveDays
}

// ---------------------------------------------------------------------------
// Main: calculate overtime for a single employee
// ---------------------------------------------------------------------------

/**
 * Calculate overtime for an employee given their time entries for the current
 * work week (across all locations for multi-location consolidation).
 *
 * @param weekEntries All time entries for this employee in the current work week (all locations)
 * @param config Overtime configuration for the primary location
 * @param targetDate The date to calculate for (defaults to today)
 */
export function calculateOvertime(
  weekEntries: TimeEntry[],
  config: OvertimeConfig,
  targetDate: Date = new Date()
): OvertimeResult {
  const now = targetDate

  // Calculate total weekly hours
  let weeklyTotalHours = 0
  for (const entry of weekEntries) {
    weeklyTotalHours += getWorkedHours(entry, now)
  }

  // Calculate total daily hours for today
  const todayEntries = getEntriesForDay(weekEntries, now)
  let dailyTotalHours = 0
  for (const entry of todayEntries) {
    dailyTotalHours += getWorkedHours(entry, now)
  }

  // Count consecutive days
  const consecutiveDays = countConsecutiveDays(weekEntries, now)

  // Initialize result
  let regularHours = 0
  let overtimeHours = 0
  let doubleTimeHours = 0
  const regularRateMultiplier = 1.0
  let overtimeRateMultiplier = config.weeklyRateMultiplier
  let doubleTimeRateMultiplier = 2.0

  if (config.rule === 'california') {
    // California rules are complex:
    // 1. Daily OT: > 8 hrs at 1.5x, > 12 hrs at 2x
    // 2. Weekly OT: > 40 hrs at 1.5x
    // 3. 7th consecutive day: first 8 hrs at 1.5x, after 8 hrs at 2x
    overtimeRateMultiplier = 1.5
    doubleTimeRateMultiplier = 2.0

    if (consecutiveDays >= 7) {
      // 7th consecutive day rules
      if (dailyTotalHours <= 8) {
        overtimeHours = dailyTotalHours
        regularHours = weeklyTotalHours - dailyTotalHours
      } else {
        overtimeHours = 8
        doubleTimeHours = dailyTotalHours - 8
        regularHours = weeklyTotalHours - dailyTotalHours
      }
    } else {
      // Standard CA daily rules
      if (dailyTotalHours > 12) {
        doubleTimeHours = dailyTotalHours - 12
        overtimeHours = 4 // hours 8-12
        const todayRegular = 8
        // Weekly calculation: total hours minus today, then add today's regular
        const otherDaysHours = weeklyTotalHours - dailyTotalHours
        regularHours = otherDaysHours + todayRegular
      } else if (dailyTotalHours > 8) {
        overtimeHours = dailyTotalHours - 8
        const todayRegular = 8
        const otherDaysHours = weeklyTotalHours - dailyTotalHours
        regularHours = otherDaysHours + todayRegular
      } else {
        regularHours = weeklyTotalHours
      }

      // Also apply weekly OT if weekly hours exceed 40
      if (regularHours > config.weeklyThresholdHours) {
        const weeklyOt = regularHours - config.weeklyThresholdHours
        overtimeHours += weeklyOt
        regularHours = config.weeklyThresholdHours
      }
    }
  } else {
    // Federal, Colorado, Custom — simpler rules
    const dailyThreshold = config.dailyThresholdHours
    const weeklyThreshold = config.weeklyThresholdHours

    // Daily OT (if applicable — not for federal)
    let dailyOt = 0
    if (dailyThreshold !== Infinity && dailyTotalHours > dailyThreshold) {
      dailyOt = dailyTotalHours - dailyThreshold
    }

    // Weekly OT
    let weeklyOt = 0
    if (weeklyTotalHours > weeklyThreshold) {
      weeklyOt = weeklyTotalHours - weeklyThreshold
    }

    // Take the larger of daily or weekly OT
    overtimeHours = Math.max(dailyOt, weeklyOt)
    regularHours = weeklyTotalHours - overtimeHours
  }

  // Approaching thresholds
  const weeklyApproachThreshold = 4 // hours before weekly threshold to warn
  const dailyApproachThreshold = 2 // hours before daily threshold to warn

  const hoursUntilWeeklyOt = Math.max(0, config.weeklyThresholdHours - weeklyTotalHours)
  const hoursUntilDailyOt =
    config.dailyThresholdHours === Infinity
      ? Infinity
      : Math.max(0, config.dailyThresholdHours - dailyTotalHours)

  const isInOvertime = overtimeHours > 0 || doubleTimeHours > 0
  const isApproachingWeeklyOt =
    !isInOvertime && hoursUntilWeeklyOt > 0 && hoursUntilWeeklyOt <= weeklyApproachThreshold
  const isApproachingDailyOt =
    !isInOvertime &&
    hoursUntilDailyOt !== Infinity &&
    hoursUntilDailyOt > 0 &&
    hoursUntilDailyOt <= dailyApproachThreshold

  return {
    regularHours: Math.max(0, regularHours),
    overtimeHours: Math.max(0, overtimeHours),
    doubleTimeHours: Math.max(0, doubleTimeHours),
    regularRateMultiplier,
    overtimeRateMultiplier,
    doubleTimeRateMultiplier,
    isApproachingWeeklyOt,
    isApproachingDailyOt,
    isInOvertime,
    hoursUntilWeeklyOt,
    hoursUntilDailyOt,
    weeklyTotalHours,
    dailyTotalHours,
    consecutiveDays,
  }
}

// ---------------------------------------------------------------------------
// Calculate pay from overtime result
// ---------------------------------------------------------------------------

/**
 * Calculate pay from overtime result and hourly rate.
 * @param result OvertimeResult from calculateOvertime
 * @param hourlyRateCents Hourly rate in cents
 * @returns Total pay in cents
 */
export function calculateOvertimePay(
  result: OvertimeResult,
  hourlyRateCents: number
): {
  regularPay: number
  overtimePay: number
  doubleTimePay: number
  totalPay: number
} {
  const regularPay = Math.round(
    result.regularHours * hourlyRateCents * result.regularRateMultiplier
  )
  const overtimePay = Math.round(
    result.overtimeHours * hourlyRateCents * result.overtimeRateMultiplier
  )
  const doubleTimePay = Math.round(
    result.doubleTimeHours * hourlyRateCents * result.doubleTimeRateMultiplier
  )

  return {
    regularPay,
    overtimePay,
    doubleTimePay,
    totalPay: regularPay + overtimePay + doubleTimePay,
  }
}

/**
 * Break Compliance Engine
 *
 * Checks break compliance per state law:
 * - California: 30-min meal before 5th hour, second before 10th hour. 10-min rest per 4 hours.
 * - New York: 30-min meal if shift > 6 hours spanning 11 AM-2 PM.
 * - Federal: No requirement, but breaks < 20 min must be paid.
 * - Custom: Configurable thresholds.
 *
 * Generates pre-alerts (15 min before deadline) and violation alerts.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BreakRuleState = 'federal' | 'california' | 'new_york' | 'custom'

export interface BreakConfig {
  state: BreakRuleState
  /** Hours before a meal break is required */
  mealThresholdHours: number
  /** Minutes for a meal break */
  mealDurationMinutes: number
  /** Hours between rest breaks */
  restThresholdHours: number
  /** Minutes for a rest break */
  restDurationMinutes: number
}

export interface BreakEntry {
  id: string
  timeEntryId: string
  startTime: Date
  endTime: Date | null
  breakType: 'meal' | 'rest' | 'paid' | 'unpaid'
  durationMinutes: number | null
}

export interface EmployeeShiftInfo {
  userId: string
  userName: string
  clockIn: Date
  breaks: BreakEntry[]
  isOnBreak: boolean
}

export interface ComplianceAlert {
  userId: string
  userName: string
  type: 'pre_alert' | 'violation'
  breakType: 'meal' | 'rest'
  message: string
  /** Minutes until deadline (negative if past) */
  minutesUntilDeadline: number
  deadlineTime: Date
}

// ---------------------------------------------------------------------------
// Default configs per state
// ---------------------------------------------------------------------------

const DEFAULT_CONFIGS: Record<BreakRuleState, BreakConfig> = {
  federal: {
    state: 'federal',
    mealThresholdHours: Infinity, // No federal requirement
    mealDurationMinutes: 30,
    restThresholdHours: Infinity, // No federal requirement
    restDurationMinutes: 10,
  },
  california: {
    state: 'california',
    mealThresholdHours: 5,
    mealDurationMinutes: 30,
    restThresholdHours: 4,
    restDurationMinutes: 10,
  },
  new_york: {
    state: 'new_york',
    mealThresholdHours: 6,
    mealDurationMinutes: 30,
    restThresholdHours: Infinity, // NY does not mandate rest breaks
    restDurationMinutes: 10,
  },
  custom: {
    state: 'custom',
    mealThresholdHours: 5,
    mealDurationMinutes: 30,
    restThresholdHours: 4,
    restDurationMinutes: 10,
  },
}

export function getDefaultBreakConfig(state: BreakRuleState): BreakConfig {
  return { ...DEFAULT_CONFIGS[state] }
}

// ---------------------------------------------------------------------------
// Pre-alert threshold (minutes before deadline)
// ---------------------------------------------------------------------------

const PRE_ALERT_MINUTES = 15

// ---------------------------------------------------------------------------
// Helper: count completed meal breaks
// ---------------------------------------------------------------------------

function countMealBreaks(breaks: BreakEntry[]): number {
  return breaks.filter(
    (b) => (b.breakType === 'meal' || b.breakType === 'unpaid') && b.endTime !== null
  ).length
}

// ---------------------------------------------------------------------------
// Helper: time since last rest break (or clock-in if no rest breaks taken)
// ---------------------------------------------------------------------------

function minutesSinceLastRest(clockIn: Date, breaks: BreakEntry[], now: Date): number {
  const restBreaks = breaks
    .filter((b) => (b.breakType === 'rest' || b.breakType === 'paid') && b.endTime !== null)
    .sort((a, b) => (b.endTime!.getTime() - a.endTime!.getTime()))

  const lastRestEnd = restBreaks.length > 0 ? restBreaks[0].endTime! : clockIn
  return (now.getTime() - lastRestEnd.getTime()) / 60000
}

// ---------------------------------------------------------------------------
// Main: check break compliance for all on-duty employees
// ---------------------------------------------------------------------------

export function checkBreakCompliance(
  employees: EmployeeShiftInfo[],
  config: BreakConfig,
  now: Date = new Date()
): ComplianceAlert[] {
  const alerts: ComplianceAlert[] = []

  for (const emp of employees) {
    if (emp.isOnBreak) continue // Currently on break, skip

    const hoursWorked = (now.getTime() - emp.clockIn.getTime()) / 3600000
    const minutesWorked = hoursWorked * 60

    // --- Meal break compliance ---
    if (config.mealThresholdHours !== Infinity) {
      const mealsTaken = countMealBreaks(emp.breaks)

      if (config.state === 'california') {
        // CA: First meal before 5th hour, second before 10th hour
        const mealsRequired = hoursWorked >= 10 ? 2 : hoursWorked >= 5 ? 1 : 0

        if (mealsTaken < mealsRequired) {
          // Already in violation
          const deadlineHours = mealsRequired === 1 ? 5 : 10
          const deadlineTime = new Date(emp.clockIn.getTime() + deadlineHours * 3600000)
          alerts.push({
            userId: emp.userId,
            userName: emp.userName,
            type: 'violation',
            breakType: 'meal',
            message: `${emp.userName} missed a required meal break (${mealsRequired === 2 ? '2nd' : '1st'} meal, ${hoursWorked.toFixed(1)} hours worked). 1-hour penalty pay may apply.`,
            minutesUntilDeadline: (deadlineTime.getTime() - now.getTime()) / 60000,
            deadlineTime,
          })
        } else {
          // Check if approaching next meal deadline
          const nextMealDeadlineHours = mealsTaken === 0 ? 5 : mealsTaken === 1 ? 10 : Infinity
          if (nextMealDeadlineHours !== Infinity) {
            const deadlineTime = new Date(
              emp.clockIn.getTime() + nextMealDeadlineHours * 3600000
            )
            const minutesUntil = (deadlineTime.getTime() - now.getTime()) / 60000

            if (minutesUntil > 0 && minutesUntil <= PRE_ALERT_MINUTES) {
              alerts.push({
                userId: emp.userId,
                userName: emp.userName,
                type: 'pre_alert',
                breakType: 'meal',
                message: `${emp.userName} must take a meal break in ${Math.round(minutesUntil)} minutes`,
                minutesUntilDeadline: minutesUntil,
                deadlineTime,
              })
            }
          }
        }
      } else if (config.state === 'new_york') {
        // NY: 30-min meal if shift > 6 hours spanning 11 AM-2 PM
        if (hoursWorked > 6 && mealsTaken === 0) {
          const eleven = new Date(now)
          eleven.setHours(11, 0, 0, 0)
          const two = new Date(now)
          two.setHours(14, 0, 0, 0)

          const shiftSpansLunch =
            emp.clockIn < two &&
            (emp.clockIn < eleven ? now > eleven : true)

          if (shiftSpansLunch) {
            alerts.push({
              userId: emp.userId,
              userName: emp.userName,
              type: 'violation',
              breakType: 'meal',
              message: `${emp.userName} has worked ${hoursWorked.toFixed(1)} hours spanning 11 AM-2 PM without a meal break`,
              minutesUntilDeadline: -1,
              deadlineTime: two,
            })
          }
        }
      } else if (config.state === 'custom') {
        // Custom: simple threshold
        if (hoursWorked >= config.mealThresholdHours && mealsTaken === 0) {
          const deadlineTime = new Date(
            emp.clockIn.getTime() + config.mealThresholdHours * 3600000
          )
          alerts.push({
            userId: emp.userId,
            userName: emp.userName,
            type: 'violation',
            breakType: 'meal',
            message: `${emp.userName} has worked ${hoursWorked.toFixed(1)} hours without a meal break`,
            minutesUntilDeadline: (deadlineTime.getTime() - now.getTime()) / 60000,
            deadlineTime,
          })
        } else if (
          mealsTaken === 0 &&
          minutesWorked / 60 < config.mealThresholdHours
        ) {
          const deadlineTime = new Date(
            emp.clockIn.getTime() + config.mealThresholdHours * 3600000
          )
          const minutesUntil = (deadlineTime.getTime() - now.getTime()) / 60000
          if (minutesUntil > 0 && minutesUntil <= PRE_ALERT_MINUTES) {
            alerts.push({
              userId: emp.userId,
              userName: emp.userName,
              type: 'pre_alert',
              breakType: 'meal',
              message: `${emp.userName} must take a meal break in ${Math.round(minutesUntil)} minutes`,
              minutesUntilDeadline: minutesUntil,
              deadlineTime,
            })
          }
        }
      }
      // Federal: no meal break requirement
    }

    // --- Rest break compliance (CA and Custom only) ---
    if (config.restThresholdHours !== Infinity) {
      const minsSinceRest = minutesSinceLastRest(emp.clockIn, emp.breaks, now)
      const thresholdMinutes = config.restThresholdHours * 60

      if (minsSinceRest >= thresholdMinutes) {
        alerts.push({
          userId: emp.userId,
          userName: emp.userName,
          type: 'violation',
          breakType: 'rest',
          message: `${emp.userName} has worked ${(minsSinceRest / 60).toFixed(1)} hours since last rest break`,
          minutesUntilDeadline: -(minsSinceRest - thresholdMinutes),
          deadlineTime: new Date(now.getTime() - (minsSinceRest - thresholdMinutes) * 60000),
        })
      } else if (thresholdMinutes - minsSinceRest <= PRE_ALERT_MINUTES) {
        const deadlineTime = new Date(
          now.getTime() + (thresholdMinutes - minsSinceRest) * 60000
        )
        alerts.push({
          userId: emp.userId,
          userName: emp.userName,
          type: 'pre_alert',
          breakType: 'rest',
          message: `${emp.userName} should take a rest break in ${Math.round(thresholdMinutes - minsSinceRest)} minutes`,
          minutesUntilDeadline: thresholdMinutes - minsSinceRest,
          deadlineTime,
        })
      }
    }
  }

  // Sort: violations first, then by urgency
  alerts.sort((a, b) => {
    if (a.type === 'violation' && b.type !== 'violation') return -1
    if (a.type !== 'violation' && b.type === 'violation') return 1
    return a.minutesUntilDeadline - b.minutesUntilDeadline
  })

  return alerts
}

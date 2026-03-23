/**
 * Turn Time Calculation Utilities
 *
 * Computes elapsed time, turn time color thresholds, and turn time statistics
 * for restaurant table management.
 */

export type TurnTimeColor = 'green' | 'yellow' | 'orange' | 'red'

export type Daypart = 'breakfast' | 'brunch' | 'lunch' | 'dinner' | 'late_night'

/** Default turn time targets in minutes per daypart */
export const DEFAULT_TURN_TIME_TARGETS: Record<Daypart, number> = {
  breakfast: 35,
  brunch: 50,
  lunch: 45,
  dinner: 75,
  late_night: 60,
}

/** Threshold multipliers relative to target */
const THRESHOLD_MULTIPLIERS = {
  green: 0.8,    // < 80% of target
  yellow: 1.0,   // 80% - 100% of target
  orange: 1.2,   // 100% - 120% of target
  red: 1.2,      // > 120% of target
} as const

/**
 * Calculate elapsed minutes from a timestamp to now.
 */
export function getElapsedMinutes(seatedAt: string | null): number {
  if (!seatedAt) return 0
  const diff = Date.now() - new Date(seatedAt).getTime()
  return Math.max(0, Math.floor(diff / 60000))
}

/**
 * Format elapsed minutes into a human-readable string.
 */
export function formatElapsedTime(minutes: number): string {
  if (minutes < 1) return '<1m'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

/**
 * Determine the current daypart based on the hour.
 */
export function getCurrentDaypart(hour?: number): Daypart {
  const h = hour ?? new Date().getHours()
  if (h >= 5 && h < 10) return 'breakfast'
  if (h >= 10 && h < 11) return 'brunch'
  if (h >= 11 && h < 15) return 'lunch'
  if (h >= 15 && h < 21) return 'dinner'
  return 'late_night'
}

/**
 * Get the turn time color based on elapsed minutes and target.
 */
export function getTurnTimeColor(
  elapsedMinutes: number,
  targetMinutes?: number,
  daypart?: Daypart
): TurnTimeColor {
  const target = targetMinutes ?? DEFAULT_TURN_TIME_TARGETS[daypart ?? getCurrentDaypart()]

  const greenThreshold = target * THRESHOLD_MULTIPLIERS.green
  const yellowThreshold = target * THRESHOLD_MULTIPLIERS.yellow
  const orangeThreshold = target * THRESHOLD_MULTIPLIERS.orange

  if (elapsedMinutes < greenThreshold) return 'green'
  if (elapsedMinutes < yellowThreshold) return 'yellow'
  if (elapsedMinutes < orangeThreshold) return 'orange'
  return 'red'
}

/**
 * CSS classes for turn time colors.
 */
export const TURN_TIME_COLORS: Record<TurnTimeColor, { bg: string; text: string; border: string }> = {
  green: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
  },
  yellow: {
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    border: 'border-amber-200',
  },
  orange: {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    border: 'border-orange-200',
  },
  red: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-200',
  },
}

/**
 * Calculate turn time in minutes from seated_at to cleared_at.
 */
export function calculateTurnTime(seatedAt: string, clearedAt: string): number {
  const seated = new Date(seatedAt).getTime()
  const cleared = new Date(clearedAt).getTime()
  return Math.max(0, Math.round((cleared - seated) / 60000))
}

/**
 * Calculate average turn time from an array of turn time records.
 */
export function calculateAverageTurnTime(
  records: Array<{ seated_at: string; cleared_at: string }>
): number {
  if (records.length === 0) return 0
  const total = records.reduce((sum, r) => {
    return sum + calculateTurnTime(r.seated_at, r.cleared_at)
  }, 0)
  return Math.round(total / records.length)
}

/**
 * Calculate estimated wait time based on average turn time and available tables.
 */
export function calculateEstimatedWait(
  avgTurnTimeMinutes: number,
  occupiedTables: number,
  totalTables: number,
  partySize?: number
): number {
  const availableTables = totalTables - occupiedTables
  if (availableTables > 0) return 0

  // Estimate based on average turn time and how "behind" we are
  // Simple heuristic: avg turn time * (parties waiting / total tables)
  if (totalTables === 0) return avgTurnTimeMinutes
  const occupancyRatio = occupiedTables / totalTables
  return Math.round(avgTurnTimeMinutes * occupancyRatio * 0.5)
}

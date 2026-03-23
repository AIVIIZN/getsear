/**
 * Daypart Engine
 *
 * Determines active dayparts for a given location/time and resolves which
 * daypart (if any) applies to a specific section at a specific moment.
 *
 * Handles:
 *  - Standard dayparts (e.g. Lunch 11:00-15:00)
 *  - Overnight spans (e.g. Late Night 22:00-02:00 crosses midnight)
 *  - Day-of-week filtering (e.g. Brunch on Sat/Sun only)
 *  - Section filtering (e.g. Happy Hour applies to Bar only)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Daypart {
  id: string
  org_id: string
  location_id: string
  name: string
  /** HH:MM format, 24-hour */
  start_time: string
  /** HH:MM format, 24-hour */
  end_time: string
  /** 0 = Sunday, 6 = Saturday */
  days: number[]
  /** Section names (e.g. "bar", "dining", "patio"). Empty array means all. */
  sections: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DaypartMatch {
  daypart: Daypart
  /** Whether the match is for the current calendar day or crossed from previous day */
  is_overnight_carryover: boolean
}

/** Default dayparts to seed for a new location */
export const DEFAULT_DAYPARTS: Omit<Daypart, 'id' | 'org_id' | 'location_id' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'Breakfast',
    start_time: '06:00',
    end_time: '11:00',
    days: [0, 1, 2, 3, 4, 5, 6],
    sections: [],
    is_active: true,
  },
  {
    name: 'Lunch',
    start_time: '11:00',
    end_time: '15:00',
    days: [0, 1, 2, 3, 4, 5, 6],
    sections: [],
    is_active: true,
  },
  {
    name: 'Happy Hour',
    start_time: '16:00',
    end_time: '18:00',
    days: [1, 2, 3, 4, 5],
    sections: [],
    is_active: true,
  },
  {
    name: 'Dinner',
    start_time: '17:00',
    end_time: '22:00',
    days: [0, 1, 2, 3, 4, 5, 6],
    sections: [],
    is_active: true,
  },
  {
    name: 'Late Night',
    start_time: '22:00',
    end_time: '02:00',
    days: [4, 5, 6],
    sections: [],
    is_active: true,
  },
  {
    name: 'Brunch',
    start_time: '09:00',
    end_time: '14:00',
    days: [0, 6],
    sections: [],
    is_active: true,
  },
]

// ---------------------------------------------------------------------------
// Time helpers (pure, no external deps)
// ---------------------------------------------------------------------------

/**
 * Parse "HH:MM" to minutes-since-midnight.
 * Returns a number in [0, 1439].
 */
export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/**
 * Convert a Date to minutes-since-midnight in a given IANA timezone.
 */
export function dateToMinutesInTimezone(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date)

  let hour = 0
  let minute = 0
  for (const part of parts) {
    if (part.type === 'hour') hour = parseInt(part.value, 10)
    if (part.type === 'minute') minute = parseInt(part.value, 10)
  }
  // Intl sometimes returns hour=24 for midnight; normalize
  if (hour === 24) hour = 0
  return hour * 60 + minute
}

/**
 * Get the day-of-week (0=Sunday) for a Date in a given timezone.
 */
export function dayOfWeekInTimezone(date: Date, timezone: string): number {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  }).format(date)

  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  }
  return map[formatted] ?? 0
}

/**
 * Get the previous day-of-week index (wraps from 0 to 6).
 */
function previousDay(day: number): number {
  return day === 0 ? 6 : day - 1
}

// ---------------------------------------------------------------------------
// Core engine
// ---------------------------------------------------------------------------

/**
 * Check if a single daypart is active at the given time (minutes) and day.
 *
 * Supports overnight spans where end_time < start_time.
 * For overnight dayparts the "start day" is checked against `days[]`,
 * meaning Late Night 22:00-02:00 on Friday means it starts Friday 22:00
 * and ends Saturday 02:00.
 */
export function isDaypartActiveAt(
  daypart: Daypart,
  currentMinutes: number,
  currentDay: number,
): boolean {
  if (!daypart.is_active) return false

  const startMin = parseTimeToMinutes(daypart.start_time)
  const endMin = parseTimeToMinutes(daypart.end_time)

  if (endMin > startMin) {
    // Normal same-day span (e.g. 11:00-15:00)
    if (currentMinutes >= startMin && currentMinutes < endMin) {
      return daypart.days.includes(currentDay)
    }
    return false
  }

  // Overnight span (e.g. 22:00-02:00)
  // The daypart started on a previous day and extends past midnight
  if (currentMinutes >= startMin) {
    // We are in the "start" portion (e.g. 22:00-23:59)
    return daypart.days.includes(currentDay)
  }
  if (currentMinutes < endMin) {
    // We are in the "carry-over" portion (e.g. 00:00-02:00)
    // The daypart's configured day is the PREVIOUS calendar day
    return daypart.days.includes(previousDay(currentDay))
  }
  return false
}

/**
 * Determine which dayparts are currently active for a given location.
 *
 * @param dayparts - All configured dayparts for the location
 * @param now - Current time as a Date (defaults to Date.now())
 * @param timezone - IANA timezone string (e.g. "America/New_York")
 * @param section - Optional section filter (e.g. "bar"). If provided, only
 *   dayparts that apply to that section (or all sections) are returned.
 */
export function getActiveDayparts(
  dayparts: Daypart[],
  timezone: string,
  now: Date = new Date(),
  section?: string,
): DaypartMatch[] {
  const currentMinutes = dateToMinutesInTimezone(now, timezone)
  const currentDay = dayOfWeekInTimezone(now, timezone)

  const matches: DaypartMatch[] = []

  for (const dp of dayparts) {
    if (!dp.is_active) continue

    // Section filter: empty sections[] means "all sections"
    if (section && dp.sections.length > 0 && !dp.sections.includes(section)) {
      continue
    }

    if (isDaypartActiveAt(dp, currentMinutes, currentDay)) {
      const startMin = parseTimeToMinutes(dp.start_time)
      const endMin = parseTimeToMinutes(dp.end_time)
      const isOvernight = endMin <= startMin && currentMinutes < endMin

      matches.push({
        daypart: dp,
        is_overnight_carryover: isOvernight,
      })
    }
  }

  return matches
}

/**
 * Find the single highest-priority active daypart for pricing.
 * When multiple dayparts overlap (e.g. Dinner and Happy Hour both active),
 * we pick the one with the most specific section match first,
 * then the shortest duration as tiebreaker (more specific = higher priority).
 */
export function getPrimaryDaypart(
  dayparts: Daypart[],
  timezone: string,
  now: Date = new Date(),
  section?: string,
): DaypartMatch | null {
  const active = getActiveDayparts(dayparts, timezone, now, section)
  if (active.length === 0) return null
  if (active.length === 1) return active[0]

  // Sort: prefer section-specific over "all sections", then shorter duration
  return active.sort((a, b) => {
    const aSpecific = a.daypart.sections.length > 0 ? 0 : 1
    const bSpecific = b.daypart.sections.length > 0 ? 0 : 1
    if (aSpecific !== bSpecific) return aSpecific - bSpecific

    // Shorter duration = more specific
    const aDuration = daypartDurationMinutes(a.daypart)
    const bDuration = daypartDurationMinutes(b.daypart)
    return aDuration - bDuration
  })[0]
}

/**
 * Calculate duration in minutes for a daypart (handles overnight).
 */
function daypartDurationMinutes(dp: Daypart): number {
  const start = parseTimeToMinutes(dp.start_time)
  const end = parseTimeToMinutes(dp.end_time)
  if (end > start) return end - start
  // Overnight
  return (1440 - start) + end
}

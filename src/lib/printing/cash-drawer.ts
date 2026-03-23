/**
 * Cash Drawer Control
 *
 * Generates ESC/POS binary commands to kick open a cash drawer connected
 * to a receipt printer via RJ-12 cable. The drawer has two possible trigger
 * pins (2 and 5) and a configurable pulse duration (100-800ms).
 *
 * ESC/POS cash drawer kick command:
 *   ESC p <pin> <on-time> <off-time>
 *   Hex: 1B 70 <m> <t1> <t2>
 *   m = 0 for pin 2, 1 for pin 5
 *   t1 = on-time  in units of 2ms (e.g. 50 = 100ms)
 *   t2 = off-time in units of 2ms (e.g. 50 = 100ms)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CashDrawerPin = 2 | 5

export interface CashDrawerConfig {
  enabled: boolean
  pin: CashDrawerPin
  /** Pulse duration in milliseconds (100-800) */
  pulse_duration: number
}

// ---------------------------------------------------------------------------
// ESC/POS Command Constants
// ---------------------------------------------------------------------------

const ESC = 0x1b
const CMD_CASH_DRAWER = 0x70

// Pin mapping: pin 2 = connector 0, pin 5 = connector 1
const PIN_MAP: Record<CashDrawerPin, number> = {
  2: 0x00,
  5: 0x01,
}

// ---------------------------------------------------------------------------
// Pulse Duration Validation
// ---------------------------------------------------------------------------

const MIN_PULSE_MS = 100
const MAX_PULSE_MS = 800

function clampPulse(ms: number): number {
  return Math.max(MIN_PULSE_MS, Math.min(MAX_PULSE_MS, ms))
}

/**
 * Convert milliseconds to ESC/POS time units (each unit = 2ms).
 * Clamps to valid range [1, 255].
 */
function msToTimeUnits(ms: number): number {
  const units = Math.round(ms / 2)
  return Math.max(1, Math.min(255, units))
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates the raw ESC/POS binary command to kick a cash drawer open.
 *
 * @param pin - Which connector pin to pulse (2 or 5)
 * @param duration - Pulse duration in milliseconds (100-800ms)
 * @returns Uint8Array containing the ESC/POS cash drawer kick command
 *
 * @example
 * ```ts
 * const cmd = generateCashDrawerKick(2, 200)
 * // Sends to printer via print queue
 * await printQueue.enqueue({ data: cmd, ... })
 * ```
 */
export function generateCashDrawerKick(
  pin: CashDrawerPin = 2,
  duration: number = 200
): Uint8Array {
  const clampedDuration = clampPulse(duration)
  const timeUnits = msToTimeUnits(clampedDuration)

  // ESC p <pin> <on-time> <off-time>
  // on-time and off-time are typically the same
  return new Uint8Array([
    ESC,
    CMD_CASH_DRAWER,
    PIN_MAP[pin],
    timeUnits,
    timeUnits,
  ])
}

/**
 * Generates a cash drawer kick command from a CashDrawerConfig object.
 * Returns null if the cash drawer is not enabled.
 */
export function generateCashDrawerKickFromConfig(
  config: CashDrawerConfig
): Uint8Array | null {
  if (!config.enabled) {
    return null
  }
  return generateCashDrawerKick(config.pin, config.pulse_duration)
}

/**
 * Validates cash drawer configuration values.
 * Returns an array of error messages (empty if valid).
 */
export function validateCashDrawerConfig(config: CashDrawerConfig): string[] {
  const errors: string[] = []

  if (config.pin !== 2 && config.pin !== 5) {
    errors.push('Pin must be 2 or 5')
  }

  if (config.pulse_duration < MIN_PULSE_MS) {
    errors.push(`Pulse duration must be at least ${MIN_PULSE_MS}ms`)
  }

  if (config.pulse_duration > MAX_PULSE_MS) {
    errors.push(`Pulse duration must be at most ${MAX_PULSE_MS}ms`)
  }

  return errors
}

/**
 * Default cash drawer configuration.
 */
export const DEFAULT_CASH_DRAWER_CONFIG: CashDrawerConfig = {
  enabled: false,
  pin: 2,
  pulse_duration: 200,
}

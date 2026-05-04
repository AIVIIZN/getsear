/**
 * Terminal driver registry — maps `device_class` → driver instance.
 *
 * Adding a new driver:
 *   1. Create `src/lib/payments/drivers/<class>.ts` exporting `default`.
 *   2. Import + register it below.
 *   3. Add the matrix entry in `compatibility-matrix.ts`.
 *
 * The compatibility matrix is the source of truth for cert status. The registry
 * filters available drivers by the binding's processor.
 */

import type { TerminalDriver, TerminalDriverMeta } from './drivers/types'
import type { Processor } from './processor-binding'
import { COMPATIBILITY_MATRIX } from './compatibility-matrix'

import valorVl100 from './drivers/valor-vl100'
import valorVl300 from './drivers/valor-vl300'
import valorVl500 from './drivers/valor-vl500'
import valorVp200 from './drivers/valor-vp200'
import verifoneP400 from './drivers/verifone-p400'
import ingenicoLane3000 from './drivers/ingenico-lane3000'
import cloverFlex from './drivers/clover-flex'

// Re-export the driver types so callers (UI, API routes, scanners) have a
// single import point.
export type {
  TerminalDriver,
  TerminalDriverMeta,
  ScannerHints,
  DeviceFamily,
} from './drivers/types'

/**
 * All registered drivers. Tap-to-Pay platforms (iOS/Android) intentionally
 * have no driver file — they are SDK-bound platform features handled by
 * `tap-to-pay-scanner.ts`. They appear in the compatibility matrix only.
 */
const DRIVERS: TerminalDriver[] = [
  valorVl100,
  valorVl300,
  valorVl500,
  valorVp200,
  verifoneP400,
  ingenicoLane3000,
  cloverFlex,
]

const DRIVER_INDEX: Map<string, TerminalDriver> = new Map(
  DRIVERS.map((d) => [d.meta.device_class, d])
)

/**
 * Look up a driver by device_class. Returns null if no driver is registered
 * (Tap-to-Pay platforms intentionally fall through to null here — the
 * scanner produces DiscoveredDevice rows for them but the driver layer
 * doesn't model them as connect()-able devices).
 */
export function getDriver(device_class: string): TerminalDriver | null {
  return DRIVER_INDEX.get(device_class) ?? null
}

/**
 * List driver metadata for every device the org's bound processor can
 * potentially use, regardless of cert status. Callers wanting only `'live'`
 * drivers should filter the result.
 */
export function listAvailableDrivers(processor: Processor): TerminalDriverMeta[] {
  const out: TerminalDriverMeta[] = []
  for (const d of DRIVERS) {
    const matrixEntry = COMPATIBILITY_MATRIX[d.meta.device_class]
    if (!matrixEntry) continue
    if (matrixEntry.processors[processor] === undefined) continue
    out.push(d.meta)
  }
  return out
}

/**
 * Helper for callers (API routes, scanners) — derive cert status for a
 * (device_class × processor) pair straight from the matrix. Returns null if
 * the combo is not in the matrix at all.
 */
export function getCertStatus(
  device_class: string,
  processor: Processor
): 'live' | 'pending_cert' | 'unsupported_until_psp_listed' | null {
  const entry = COMPATIBILITY_MATRIX[device_class]
  if (!entry) return null
  return entry.processors[processor] ?? null
}

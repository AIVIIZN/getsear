/**
 * Auto-detect orchestrator — fans out across all scanners (mDNS, USB,
 * Bluetooth, Tap-to-Pay) in parallel, applies a global timeout, and merges
 * results into a single DiscoveredDevice list.
 *
 * Scanners are independent and may fail (missing optional dep, no LAN access,
 * etc.); we use Promise.allSettled so a single scanner crash doesn't prevent
 * the others from contributing.
 */

import type { Processor } from './processor-binding'
import { getCertStatus } from './terminal-registry'

import * as mdns from './scanners/mdns-scanner'
import * as usb from './scanners/usb-scanner'
import * as bluetooth from './scanners/bluetooth-scanner'
import * as tapToPay from './scanners/tap-to-pay-scanner'

export interface DiscoveredDevice {
  /** Driver registry key, e.g. 'valor-vl100'. */
  device_class: string
  mfg: string
  model: string
  /** Network/serial/BT identifier — interpretation depends on scanner. */
  identifier: string
  /** True iff cert_status === 'live' for the org's processor. */
  supported: boolean
  cert_status: 'live' | 'pending_cert' | 'unsupported_until_psp_listed'
  /** Human-readable explanation when supported=false. */
  reason_if_unsupported?: string
}

const DEFAULT_TIMEOUT_MS = 5000

interface ScannerLike {
  scan(processor: Processor, timeoutMs: number): Promise<DiscoveredDevice[]>
}

const SCANNERS: ReadonlyArray<{ name: string; impl: ScannerLike }> = [
  { name: 'mdns', impl: mdns },
  { name: 'usb', impl: usb },
  { name: 'bluetooth', impl: bluetooth },
  { name: 'tap-to-pay', impl: tapToPay },
]

/**
 * Run all scanners in parallel and merge results. Per-scanner timeout is the
 * same as the overall timeout (each scanner is responsible for honoring it,
 * but `Promise.race` here enforces an upper bound regardless).
 */
export async function autoDetect(
  processor: Processor,
  opts?: { timeoutMs?: number }
): Promise<DiscoveredDevice[]> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const wrapped = SCANNERS.map(({ name, impl }) =>
    Promise.race<DiscoveredDevice[]>([
      impl.scan(processor, timeoutMs).catch((err) => {
        console.warn(`[auto-detect] scanner '${name}' failed:`, err)
        return [] as DiscoveredDevice[]
      }),
      new Promise<DiscoveredDevice[]>((resolve) =>
        setTimeout(() => resolve([]), timeoutMs + 250)
      ),
    ])
  )

  const settled = await Promise.allSettled(wrapped)
  const merged: DiscoveredDevice[] = []
  const seen = new Set<string>()

  for (const result of settled) {
    if (result.status !== 'fulfilled') continue
    for (const dev of result.value) {
      // Re-derive cert status from the matrix to guard against scanners that
      // copy stale meta. Matrix is the source of truth.
      const cert = getCertStatus(dev.device_class, processor) ?? dev.cert_status
      const enriched: DiscoveredDevice = {
        ...dev,
        cert_status: cert,
        supported: cert === 'live',
      }
      const key = `${enriched.device_class}|${enriched.identifier}`
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(enriched)
    }
  }

  return merged
}

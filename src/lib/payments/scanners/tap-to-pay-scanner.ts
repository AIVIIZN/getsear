/**
 * Tap-to-Pay scanner — checks platform availability for the org's bound
 * processor.
 *
 * Tap-to-Pay (iOS = Tap to Pay on iPhone, Android = Google Tap to Pay) is
 * a platform feature gated by the PSP being on Apple/Google's allowlist.
 * As of V5.2.0 build time, Valor is not on either allowlist, so the matrix
 * lists both as `unsupported_until_psp_listed`.
 *
 * When the matrix flips a Tap-to-Pay class to `'live'` (no other code change
 * required), this scanner emits a single DiscoveredDevice with a synthetic
 * identifier. The actual platform attestation happens client-side in the
 * native bridge (V9 batch) — the server scanner only signals availability.
 */

import { getCertStatus } from '../terminal-registry'
import type { Processor } from '../processor-binding'
import type { DiscoveredDevice } from '../auto-detect'

const TAP_TO_PAY_CLASSES = ['ios-tap-to-pay', 'android-tap-to-pay'] as const

export async function scan(
  processor: Processor,
  timeoutMs: number
): Promise<DiscoveredDevice[]> {
  void timeoutMs
  const out: DiscoveredDevice[] = []
  for (const device_class of TAP_TO_PAY_CLASSES) {
    const cert = getCertStatus(device_class, processor)
    if (cert === null) continue

    if (cert === 'live') {
      // Platform is allow-listed — emit a single device row. The real
      // attestation happens in the client bridge.
      const platform = device_class === 'ios-tap-to-pay' ? 'iOS' : 'Android'
      out.push({
        device_class,
        mfg: 'Apple/Google',
        model: `${platform} Tap-to-Pay`,
        identifier: `${device_class}:host`,
        supported: true,
        cert_status: 'live',
      })
      continue
    }

    // unsupported_until_psp_listed — do NOT emit. The settings page can
    // separately surface "Tap-to-Pay coming soon" copy by reading the matrix
    // directly. We don't pollute discovery results with non-actionable rows.
  }
  return out
}

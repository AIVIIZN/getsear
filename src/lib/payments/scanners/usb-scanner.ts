/**
 * USB scanner — stub. Web USB is browser-only and the discovery API requires
 * a user gesture to authorize device enumeration, so server-side scanning is
 * impossible. The actual hardware enumeration happens client-side in V5.2.1+
 * via the WebUSB-aware setup wizard.
 *
 * For the V5.2.0 framework: returns []. This keeps the API contract stable
 * (every scanner has the same signature) while making it obvious that USB
 * discovery is deferred to the client.
 */

import type { Processor } from '../processor-binding'
import type { DiscoveredDevice } from '../auto-detect'

export async function scan(
  processor: Processor,
  timeoutMs: number
): Promise<DiscoveredDevice[]> {
  // Web USB requires `navigator.usb` + a user gesture (security requirement).
  // Server runtime has neither. Real enumeration ships in the client wizard.
  void processor
  void timeoutMs
  return []
}

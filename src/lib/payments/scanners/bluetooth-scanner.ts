/**
 * Bluetooth scanner — stub. Web Bluetooth is browser-only and requires a
 * user gesture to expose `requestDevice()`. Server-side BLE scanning would
 * require a native binding (e.g. noble) that is not in our dependency tree.
 *
 * For V5.2.0: returns []. The client setup wizard performs `requestDevice`
 * with the GATT service UUIDs from the registry's `scanner_hints` in V5.2.1+.
 */

import type { Processor } from '../processor-binding'
import type { DiscoveredDevice } from '../auto-detect'

export async function scan(
  processor: Processor,
  timeoutMs: number
): Promise<DiscoveredDevice[]> {
  // Web Bluetooth requires `navigator.bluetooth.requestDevice()` (user
  // gesture). Server runtime has neither. Real enumeration ships in the
  // client wizard.
  void processor
  void timeoutMs
  return []
}

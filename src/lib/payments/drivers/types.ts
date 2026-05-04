/**
 * Shared driver interface for all payment terminals (Valor's own + future
 * alternative-mfg hardware once Valor cert lands).
 *
 * Each driver file in `src/lib/payments/drivers/` exports a `default`
 * TerminalDriver. The registry indexes them by `meta.device_class`.
 */

import type { Processor } from '../processor-binding'
import type { CertStatus } from '../compatibility-matrix'

export type DeviceFamily =
  | 'handheld'
  | 'countertop'
  | 'pinpad'
  | 'smart-pos'
  | 'tap-to-pay-on-phone'

export interface ScannerHints {
  /** mDNS service type, e.g. '_pdl-datastream._tcp.' or vendor-specific */
  mdns_service?: string
  /** USB vendor ID for HID/CDC enumeration (browser-only via Web USB) */
  usb_vendor_id?: number
  /** USB product ID, paired with vendor_id */
  usb_product_id?: number
  /** Bluetooth GATT service UUID for BLE pinpads */
  bluetooth_service_uuid?: string
}

export interface TerminalDriverMeta {
  /** Unique key, e.g. 'valor-vl100'. Used as the lookup key in the registry. */
  device_class: string
  mfg: string
  model: string
  family: DeviceFamily
  /** Which processors this hardware can integrate with (intent, not cert). */
  supported_processors: Processor[]
  /**
   * Effective cert status for the day-1 processor (Valor). The compatibility
   * matrix is the source of truth; the driver duplicates it here so callers
   * can read meta without joining tables.
   */
  cert_status: CertStatus
  scanner_hints: ScannerHints
}

export interface TerminalDriver {
  meta: TerminalDriverMeta
  /**
   * Open a connection to the device.
   *   - 'live' drivers: log "STUB: would connect to <class> at <id>" and
   *     resolve. Real wire-protocol implementation lands per-driver in
   *     V5.2.2+ (Valor SDK first).
   *   - 'pending_cert' drivers: throw with a message naming the cert gap.
   *   - 'unsupported_until_psp_listed' drivers: throw with platform-specific
   *     PSP allowlist messaging.
   */
  connect(identifier: string): Promise<void>
  disconnect(): Promise<void>
}

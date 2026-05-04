/**
 * Ingenico Lane 3000 — countertop pinpad.
 * Driver stub. Cert status: pending Valor EMV certification.
 * connect() throws until cert lands; matrix flips to 'live' in V9 batch.
 */

import type { TerminalDriver } from './types'

const driver: TerminalDriver = {
  meta: {
    device_class: 'ingenico-lane3000',
    mfg: 'Ingenico',
    model: 'Lane 3000',
    family: 'countertop',
    supported_processors: ['valor'],
    cert_status: 'pending_cert',
    scanner_hints: {
      mdns_service: '_ingenico._tcp.',
      usb_vendor_id: 0x0b00,
    },
  },
  async connect(identifier: string): Promise<void> {
    void identifier
    throw new Error(
      'Driver ingenico-lane3000 is pending Valor EMV certification — not enabled in production'
    )
  },
  async disconnect(): Promise<void> {
    /* noop */
  },
}

export default driver

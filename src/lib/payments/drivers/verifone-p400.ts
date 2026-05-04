/**
 * Verifone P400 — countertop pinpad.
 * Driver stub. Cert status: pending Valor EMV certification.
 * connect() throws until cert lands; matrix flips to 'live' in V9 batch.
 */

import type { TerminalDriver } from './types'

const driver: TerminalDriver = {
  meta: {
    device_class: 'verifone-p400',
    mfg: 'Verifone',
    model: 'P400',
    family: 'countertop',
    supported_processors: ['valor'],
    cert_status: 'pending_cert',
    scanner_hints: {
      // Verifone Engage line — Bonjour service. Placeholder; verify in V9.
      mdns_service: '_verifone._tcp.',
      // USB vendor IDs sourced from Verifone's developer docs.
      usb_vendor_id: 0x11ca,
    },
  },
  async connect(identifier: string): Promise<void> {
    void identifier
    throw new Error(
      'Driver verifone-p400 is pending Valor EMV certification — not enabled in production'
    )
  },
  async disconnect(): Promise<void> {
    /* noop */
  },
}

export default driver

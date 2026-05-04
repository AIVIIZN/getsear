/**
 * Valor VL100 — handheld payment terminal.
 * Driver stub. Real wire-protocol implementation lands in V5.2.2 (Valor SDK).
 * Cert status: live for Valor.
 */

import type { TerminalDriver } from './types'

const driver: TerminalDriver = {
  meta: {
    device_class: 'valor-vl100',
    mfg: 'Valor',
    model: 'VL100',
    family: 'handheld',
    supported_processors: ['valor'],
    cert_status: 'live',
    scanner_hints: {
      mdns_service: '_valor-pos._tcp.',
    },
  },
  async connect(identifier: string): Promise<void> {
    console.log(`STUB: would connect to valor-vl100 at ${identifier}`)
  },
  async disconnect(): Promise<void> {
    /* noop */
  },
}

export default driver

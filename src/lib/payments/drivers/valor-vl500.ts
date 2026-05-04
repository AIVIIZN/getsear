/**
 * Valor VL500 — smart Android-based POS terminal.
 * Driver stub. Real wire-protocol implementation lands in V5.2.2 (Valor SDK).
 * Cert status: live for Valor.
 */

import type { TerminalDriver } from './types'

const driver: TerminalDriver = {
  meta: {
    device_class: 'valor-vl500',
    mfg: 'Valor',
    model: 'VL500',
    family: 'smart-pos',
    supported_processors: ['valor'],
    cert_status: 'live',
    scanner_hints: {
      mdns_service: '_valor-pos._tcp.',
    },
  },
  async connect(identifier: string): Promise<void> {
    console.log(`STUB: would connect to valor-vl500 at ${identifier}`)
  },
  async disconnect(): Promise<void> {
    /* noop */
  },
}

export default driver

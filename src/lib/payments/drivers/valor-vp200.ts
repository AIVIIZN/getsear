/**
 * Valor VP200 — Bluetooth pinpad (companion to a tablet/phone POS).
 * Driver stub. Real wire-protocol implementation lands in V5.2.2 (Valor SDK).
 * Cert status: live for Valor.
 */

import type { TerminalDriver } from './types'

const driver: TerminalDriver = {
  meta: {
    device_class: 'valor-vp200',
    mfg: 'Valor',
    model: 'VP200',
    family: 'pinpad',
    supported_processors: ['valor'],
    cert_status: 'live',
    scanner_hints: {
      // Valor's published BLE service UUID for the VP200 family.
      // Placeholder until we confirm against the real SDK in 5.2.2.
      bluetooth_service_uuid: '0000fff0-0000-1000-8000-00805f9b34fb',
    },
  },
  async connect(identifier: string): Promise<void> {
    console.log(`STUB: would connect to valor-vp200 at ${identifier}`)
  },
  async disconnect(): Promise<void> {
    /* noop */
  },
}

export default driver

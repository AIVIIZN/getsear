/**
 * Clover Flex — handheld smart-POS device.
 * Driver stub. Cert status: pending Valor EMV certification.
 * connect() throws until cert lands; matrix flips to 'live' in V9 batch.
 */

import type { TerminalDriver } from './types'

const driver: TerminalDriver = {
  meta: {
    device_class: 'clover-flex',
    mfg: 'Clover',
    model: 'Flex',
    family: 'handheld',
    supported_processors: ['valor'],
    cert_status: 'pending_cert',
    scanner_hints: {
      mdns_service: '_clover._tcp.',
    },
  },
  async connect(identifier: string): Promise<void> {
    void identifier
    throw new Error(
      'Driver clover-flex is pending Valor EMV certification — not enabled in production'
    )
  },
  async disconnect(): Promise<void> {
    /* noop */
  },
}

export default driver

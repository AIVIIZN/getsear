/**
 * Compatibility matrix — single source of truth for which (device_class ×
 * processor) combos are allowed and at what cert status.
 *
 * Day-1 contents (V5.2.0):
 *   - Valor's own hardware (VL100/VL300/VL500/VP200) → 'live'.
 *   - Verifone P400 / Ingenico Lane 3000 / Clover Flex → 'pending_cert'
 *     (drivers exist as stubs; runtime rejects until Valor cert lands).
 *   - iOS / Android Tap-to-Pay → 'unsupported_until_psp_listed' (Valor not on
 *     Apple/Google PSP allowlist as of build time; can flip to 'live' when
 *     status changes — single edit here, no other code changes needed).
 *
 * NOTE: this file contains data only. No helpers, no functions. Helpers live
 * in `terminal-registry.ts` and consult this matrix.
 */

import type { Processor } from './processor-binding'

export type CertStatus = 'live' | 'pending_cert' | 'unsupported_until_psp_listed'

export interface CompatibilityEntry {
  processors: Partial<Record<Processor, CertStatus>>
}

export const COMPATIBILITY_MATRIX: Record<string, CompatibilityEntry> = {
  'valor-vl100': { processors: { valor: 'live' } },
  'valor-vl300': { processors: { valor: 'live' } },
  'valor-vl500': { processors: { valor: 'live' } },
  'valor-vp200': { processors: { valor: 'live' } },
  'verifone-p400': { processors: { valor: 'pending_cert' } },
  'ingenico-lane3000': { processors: { valor: 'pending_cert' } },
  'clover-flex': { processors: { valor: 'pending_cert' } },
  'ios-tap-to-pay': { processors: { valor: 'unsupported_until_psp_listed' } },
  'android-tap-to-pay': { processors: { valor: 'unsupported_until_psp_listed' } },
}

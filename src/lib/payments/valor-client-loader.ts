/**
 * Valor Client Loader
 *
 * Provides a unified interface to the Valor payment processor.
 * When VALOR_MODE=live, imports the real valor-client (built by Worker E).
 * When VALOR_MODE=mock (or absent), falls back to the mock client.
 *
 * This module ensures all payment routes use a consistent interface
 * regardless of whether we're hitting the real Valor API or the mock.
 */

import { valorMock } from '@/lib/payments/valor-mock'

// ---------------------------------------------------------------------------
// Unified Valor Client Interface
// ---------------------------------------------------------------------------

export interface ValorClientInterface {
  authorize: (req: {
    amount_cents: number
    order_id: string
    terminal_id?: string
  }) => Promise<{
    success: boolean
    transaction_id: string
    auth_code: string
    card_last_four: string
    card_brand: string
    decline_reason?: string
  }>

  preauth: (req: {
    amount_cents: number
    order_id: string
    terminal_id?: string
  }) => Promise<{
    success: boolean
    transaction_id: string
    auth_code: string
    card_last_four: string
    card_brand: string
    decline_reason?: string
  }>

  capture: (req: {
    transaction_id: string
    amount_cents: number
    tip_cents: number
  }) => Promise<{
    success: boolean
    transaction_id: string
    captured_amount_cents: number
  }>

  void: (req: {
    transaction_id: string
  }) => Promise<{
    success: boolean
    transaction_id: string
  }>

  refund: (req: {
    transaction_id: string
    amount_cents: number
  }) => Promise<{
    success: boolean
    transaction_id: string
    refund_amount_cents: number
  }>

  incrementalAuth: (req: {
    transaction_id: string
    additional_amount_cents: number
  }) => Promise<{
    success: boolean
    transaction_id: string
    new_auth_amount_cents: number
  }>

  batchClose: (req: {
    location_id: string
  }) => Promise<{
    success: boolean
    batch_id: string
    transaction_count: number
    gross_amount_cents: number
    net_amount_cents: number
  }>

  tipAdjust: (req: {
    transaction_id: string
    tip_cents: number
  }) => Promise<{
    success: boolean
    transaction_id: string
    new_total_cents: number
  }>
}

// ---------------------------------------------------------------------------
// Mock adapter that wraps the existing valorMock to match the unified interface
// ---------------------------------------------------------------------------

const mockAdapter: ValorClientInterface = {
  authorize: (req) => valorMock.authorize(req),
  preauth: (req) => valorMock.preauth(req),
  capture: (req) => valorMock.capture(req),
  void: (req) => valorMock.void(req),
  refund: (req) => valorMock.refund(req),

  incrementalAuth: async (req) => {
    // Mock: always succeed with incremental auth
    await new Promise((resolve) => setTimeout(resolve, 500))
    return {
      success: true,
      transaction_id: req.transaction_id,
      new_auth_amount_cents: req.additional_amount_cents,
    }
  },

  batchClose: async (req) => {
    // Mock: simulate batch close
    await new Promise((resolve) => setTimeout(resolve, 1000))
    const timestamp = Date.now().toString(36).toUpperCase()
    return {
      success: true,
      batch_id: `BATCH-${timestamp}`,
      transaction_count: 0, // Will be overridden by caller
      gross_amount_cents: 0,
      net_amount_cents: 0,
    }
  },

  tipAdjust: async (req) => {
    await new Promise((resolve) => setTimeout(resolve, 600))
    return {
      success: true,
      transaction_id: req.transaction_id,
      new_total_cents: req.tip_cents,
    }
  },
}

/**
 * Returns the appropriate Valor client based on VALOR_MODE env var.
 * Defaults to mock if VALOR_MODE is not set or is 'mock'.
 */
export function getValorClient(): ValorClientInterface {
  const mode = process.env.VALOR_MODE ?? 'mock'

  if (mode === 'live') {
    // Dynamic import would be used here when Worker E's valor-client.ts is ready.
    // For now, we check if the module exists and fall back to mock.
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const liveClient = require('@/lib/payments/valor-client')
      if (liveClient && typeof liveClient.valorClient === 'object') {
        return liveClient.valorClient as ValorClientInterface
      }
    } catch {
      // valor-client.ts not yet built by Worker E — use mock
      console.warn('[Valor] Live mode requested but valor-client.ts not available. Falling back to mock.')
    }
  }

  return mockAdapter
}

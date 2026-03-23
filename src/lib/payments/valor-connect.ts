/**
 * Valor Connect MQTT Client — Terminal Communication
 *
 * Handles communication with Valor payment terminals (VP800, VP550,
 * VP300 Pro, RCKT) via MQTT messaging. In sandbox mode, simulates
 * terminal responses with realistic delays.
 *
 * Environment variables:
 *   VALOR_MQTT_BROKER    — MQTT broker URL (e.g., mqtt://connect.valorpaytech.com)
 *   VALOR_MQTT_USERNAME  — MQTT auth username
 *   VALOR_MQTT_PASSWORD  — MQTT auth password
 *   VALOR_ENVIRONMENT    — 'sandbox' | 'production'
 *
 * Card data is handled entirely by the terminal (P2PE).
 * We NEVER see or log full card numbers.
 */

import type { CardBrand, ValorDeclineCode } from './valor-client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TerminalStatus =
  | 'online'
  | 'offline'
  | 'busy'
  | 'idle'
  | 'error'

export type TerminalModel = 'VP800' | 'VP550' | 'VP300_Pro' | 'RCKT'

export interface ValorTerminal {
  terminal_id: string
  model: TerminalModel
  serial_number: string
  status: TerminalStatus
  firmware_version: string
  last_seen_at: string
  location_id?: string
  label?: string
}

export type TerminalEvent =
  | 'card_presented'
  | 'pin_entered'
  | 'signature_required'
  | 'transaction_complete'
  | 'transaction_declined'
  | 'transaction_error'
  | 'terminal_ready'
  | 'terminal_timeout'
  | 'card_removed'
  | 'cancelled_by_customer'

export interface TerminalEventPayload {
  event: TerminalEvent
  terminal_id: string
  transaction_id?: string
  timestamp: string
  data?: {
    card_last_four?: string
    card_brand?: CardBrand
    auth_code?: string
    amount_cents?: number
    decline_code?: ValorDeclineCode
    decline_reason?: string
    entry_mode?: string
    signature_data?: string
  }
}

export interface TerminalTransactionRequest {
  terminal_id: string
  transaction_type: 'sale' | 'auth' | 'void' | 'refund'
  amount_cents: number
  order_id: string
  tip_enabled?: boolean
  dual_pricing_enabled?: boolean
  dual_pricing_rate?: number
  reference?: string
}

export type TerminalEventCallback = (event: TerminalEventPayload) => void

// ---------------------------------------------------------------------------
// Sandbox simulation
// ---------------------------------------------------------------------------

const MOCK_TERMINALS: ValorTerminal[] = [
  {
    terminal_id: 'TERM-001',
    model: 'VP800',
    serial_number: 'VP800-2024-001',
    status: 'idle',
    firmware_version: '3.2.1',
    last_seen_at: new Date().toISOString(),
    label: 'Bar Terminal',
  },
  {
    terminal_id: 'TERM-002',
    model: 'VP550',
    serial_number: 'VP550-2024-002',
    status: 'idle',
    firmware_version: '2.8.4',
    last_seen_at: new Date().toISOString(),
    label: 'Front Counter',
  },
  {
    terminal_id: 'TERM-003',
    model: 'RCKT',
    serial_number: 'RCKT-2024-003',
    status: 'idle',
    firmware_version: '1.5.0',
    last_seen_at: new Date().toISOString(),
    label: 'Tableside',
  },
]

const MOCK_CARD_BRANDS: CardBrand[] = ['visa', 'mastercard', 'amex', 'discover']
const MOCK_LAST_FOURS = ['4242', '1234', '5678', '9012']
const MOCK_ENTRY_MODES = ['emv', 'contactless', 'swipe']

function randomFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function isSandbox(): boolean {
  return (process.env.VALOR_ENVIRONMENT ?? 'sandbox') !== 'production'
}

// ---------------------------------------------------------------------------
// Valor Connect Client
// ---------------------------------------------------------------------------

/**
 * In-memory event listeners. In production this would be MQTT subscriptions;
 * in sandbox mode we simulate with event emitters.
 */
const eventListeners = new Map<string, Set<TerminalEventCallback>>()

/** Track active sandbox simulations so they can be cancelled */
const activeSimulations = new Map<string, { abort: () => void }>()

export const valorConnect = {
  /**
   * Discover available Valor terminals on the network.
   * In sandbox: returns mock terminals.
   * In production: publishes discovery request to MQTT and collects responses.
   */
  async discoverTerminals(locationId?: string): Promise<ValorTerminal[]> {
    if (isSandbox()) {
      await new Promise((r) => setTimeout(r, 500))
      return MOCK_TERMINALS.map((t) => ({
        ...t,
        location_id: locationId,
        last_seen_at: new Date().toISOString(),
      }))
    }

    // Production: publish discovery request and wait for responses
    // Real MQTT implementation would go here
    // For now, return empty array until MQTT client is configured
    console.warn('[ValorConnect] Production MQTT not configured — no terminals discovered')
    return []
  },

  /**
   * Get a specific terminal's current status.
   */
  async getTerminalStatus(terminalId: string): Promise<ValorTerminal | null> {
    if (isSandbox()) {
      const terminal = MOCK_TERMINALS.find((t) => t.terminal_id === terminalId)
      if (!terminal) return null
      return { ...terminal, last_seen_at: new Date().toISOString() }
    }

    // Production: query terminal via MQTT
    return null
  },

  /**
   * Send a transaction request to a terminal.
   * The terminal handles all card interaction (P2PE).
   * Events are emitted via subscribed callbacks.
   *
   * Returns a promise that resolves when the terminal transaction completes
   * or rejects on timeout (120 seconds).
   */
  async sendTransaction(
    request: TerminalTransactionRequest
  ): Promise<TerminalEventPayload> {
    const { terminal_id, transaction_type, amount_cents, order_id } = request

    if (isSandbox()) {
      return simulateTerminalTransaction(request)
    }

    // Production: publish to MQTT command topic
    return new Promise<TerminalEventPayload>((resolve, reject) => {
      const timeoutMs = 120_000
      let resolved = false

      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true
          cleanup()
          reject(new TerminalTimeoutError(terminal_id, timeoutMs))
        }
      }, timeoutMs)

      const onEvent = (event: TerminalEventPayload) => {
        if (event.event === 'transaction_complete' || event.event === 'transaction_declined' || event.event === 'transaction_error') {
          if (!resolved) {
            resolved = true
            clearTimeout(timeoutId)
            cleanup()
            resolve(event)
          }
        }
      }

      const cleanup = () => {
        const listeners = eventListeners.get(terminal_id)
        if (listeners) {
          listeners.delete(onEvent)
        }
      }

      // Subscribe to events for this terminal
      this.subscribe(terminal_id, onEvent)

      // Publish command to MQTT
      console.log(`[ValorConnect] Publishing ${transaction_type} to terminal ${terminal_id}: ${amount_cents} cents, order ${order_id}`)
    })
  },

  /**
   * Subscribe to events from a specific terminal.
   */
  subscribe(terminalId: string, callback: TerminalEventCallback): void {
    if (!eventListeners.has(terminalId)) {
      eventListeners.set(terminalId, new Set())
    }
    eventListeners.get(terminalId)!.add(callback)
  },

  /**
   * Unsubscribe from terminal events.
   */
  unsubscribe(terminalId: string, callback: TerminalEventCallback): void {
    const listeners = eventListeners.get(terminalId)
    if (listeners) {
      listeners.delete(callback)
      if (listeners.size === 0) {
        eventListeners.delete(terminalId)
      }
    }
  },

  /**
   * Cancel an in-progress terminal transaction.
   */
  cancelTransaction(terminalId: string): void {
    const simulation = activeSimulations.get(terminalId)
    if (simulation) {
      simulation.abort()
      activeSimulations.delete(terminalId)
    }

    emitEvent(terminalId, {
      event: 'cancelled_by_customer',
      terminal_id: terminalId,
      timestamp: new Date().toISOString(),
    })
  },
}

// ---------------------------------------------------------------------------
// Sandbox simulation logic
// ---------------------------------------------------------------------------

function emitEvent(terminalId: string, event: TerminalEventPayload): void {
  const listeners = eventListeners.get(terminalId)
  if (listeners) {
    listeners.forEach((cb) => cb(event))
  }
}

async function simulateTerminalTransaction(
  request: TerminalTransactionRequest
): Promise<TerminalEventPayload> {
  const { terminal_id, amount_cents } = request
  let aborted = false

  const abortController = {
    abort: () => { aborted = true },
  }

  activeSimulations.set(terminal_id, abortController)

  try {
    // Step 1: Terminal ready (500ms)
    await new Promise((r) => setTimeout(r, 500))
    if (aborted) throw new TerminalCancelledError(terminal_id)

    emitEvent(terminal_id, {
      event: 'terminal_ready',
      terminal_id,
      timestamp: new Date().toISOString(),
    })

    // Step 2: Wait for card presentation (1.5-3s simulated customer action)
    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1500))
    if (aborted) throw new TerminalCancelledError(terminal_id)

    const cardBrand = randomFrom(MOCK_CARD_BRANDS)
    const lastFour = randomFrom(MOCK_LAST_FOURS)
    const entryMode = randomFrom(MOCK_ENTRY_MODES)

    emitEvent(terminal_id, {
      event: 'card_presented',
      terminal_id,
      timestamp: new Date().toISOString(),
      data: {
        card_brand: cardBrand,
        card_last_four: lastFour,
        entry_mode: entryMode,
      },
    })

    // Step 3: Processing (1-2s)
    await new Promise((r) => setTimeout(r, 1000 + Math.random() * 1000))
    if (aborted) throw new TerminalCancelledError(terminal_id)

    // 95% approval, amounts ending in 66 always decline
    const shouldDecline = amount_cents % 100 === 66 || Math.random() < 0.05

    if (shouldDecline) {
      const declineEvent: TerminalEventPayload = {
        event: 'transaction_declined',
        terminal_id,
        transaction_id: `VLR-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        timestamp: new Date().toISOString(),
        data: {
          card_last_four: lastFour,
          card_brand: cardBrand,
          amount_cents,
          decline_code: 'insufficient_funds',
          decline_reason: 'Insufficient funds',
          entry_mode: entryMode,
        },
      }

      emitEvent(terminal_id, declineEvent)
      return declineEvent
    }

    const txnId = `VLR-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    const authCode = Math.random().toString(36).substring(2, 8).toUpperCase()

    const completeEvent: TerminalEventPayload = {
      event: 'transaction_complete',
      terminal_id,
      transaction_id: txnId,
      timestamp: new Date().toISOString(),
      data: {
        card_last_four: lastFour,
        card_brand: cardBrand,
        auth_code: authCode,
        amount_cents,
        entry_mode: entryMode,
      },
    }

    emitEvent(terminal_id, completeEvent)
    return completeEvent
  } finally {
    activeSimulations.delete(terminal_id)
  }
}

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class TerminalTimeoutError extends Error {
  constructor(
    public readonly terminalId: string,
    public readonly timeoutMs: number
  ) {
    super(`Terminal ${terminalId} did not respond within ${timeoutMs / 1000} seconds`)
    this.name = 'TerminalTimeoutError'
  }
}

export class TerminalCancelledError extends Error {
  constructor(public readonly terminalId: string) {
    super(`Transaction on terminal ${terminalId} was cancelled`)
    this.name = 'TerminalCancelledError'
  }
}

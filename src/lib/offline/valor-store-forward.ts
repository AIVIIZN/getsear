/**
 * Store-and-forward for Valor payment terminals on local network.
 * When internet is down but the Valor terminal is reachable locally:
 * - Process card through the terminal (local Bluetooth/IP)
 * - Store authorization reference
 * - Queue for settlement when internet returns
 *
 * Max $200 default (configurable). Above = manager PIN required.
 * 24hr settlement window.
 */

import { enqueueSync } from './sync-queue'
import { getStoreForwardMaxCents } from './settings-cache'
import { isManagerRole, validateStaffPinOffline } from './staff-cache'
import { pingValorTerminal } from './health-check'
import { offlineDB } from './db'
import { useOfflineStore } from '@/stores/offline-store'

export interface StoreForwardResult {
  success: boolean
  error?: string
  requires_manager_pin?: boolean
  terminal_unreachable?: boolean
  transaction_ref?: string
  payment_id?: string
}

export interface ValorLocalAuth {
  transaction_ref: string
  amount_cents: number
  tip_cents: number
  terminal_id: string
  card_last_four: string
  card_brand: string
  auth_code: string
  created_at: string
}

/**
 * Attempt a store-and-forward card payment via local Valor terminal.
 */
export async function processStoreForward(params: {
  order_id: string
  amount_cents: number
  tip_cents: number
  terminal_ip: string
  terminal_id: string
  terminal_port?: number
  staff_id: string
  location_id: string
  manager_pin?: string
}): Promise<StoreForwardResult> {
  // Check if amount exceeds configured maximum
  const maxCents = await getStoreForwardMaxCents(params.location_id)

  if (params.amount_cents > maxCents) {
    // Requires manager PIN
    if (!params.manager_pin) {
      return {
        success: false,
        requires_manager_pin: true,
        error: `Amount exceeds store-and-forward limit of $${(maxCents / 100).toFixed(2)}. Manager PIN required.`,
      }
    }

    // Validate manager PIN
    const isManager = await isManagerRole(params.staff_id)
    if (!isManager) {
      // Need a manager to approve
      const managerValid = await validateManagerPin(params.manager_pin, params.location_id)
      if (!managerValid) {
        return { success: false, error: 'Invalid manager PIN.' }
      }
    }
  }

  // Check if Valor terminal is reachable
  const terminalReachable = await pingValorTerminal(params.terminal_ip, params.terminal_port)
  if (!terminalReachable) {
    return {
      success: false,
      terminal_unreachable: true,
      error: 'Card payments unavailable — Valor terminal not reachable. Cash only while offline.',
    }
  }

  // Send card request to Valor terminal on local network
  // The terminal handles the card interaction directly
  try {
    const authResult = await sendToValorTerminal({
      terminal_ip: params.terminal_ip,
      terminal_port: params.terminal_port ?? 8443,
      amount_cents: params.amount_cents,
      tip_cents: params.tip_cents,
    })

    // Create payment record in IndexedDB
    const paymentId = crypto.randomUUID()
    await offlineDB.orders.update(params.order_id, {
      status: 'closed',
      sync_status: 'store_and_forward',
      synced_at: new Date().toISOString(),
    })

    // Enqueue for settlement when online
    await enqueueSync({
      operation: 'settle_payment',
      entity_type: 'payment',
      entity_id: paymentId,
      payload: {
        order_id: params.order_id,
        payment_method: 'card',
        amount_cents: params.amount_cents,
        tip_cents: params.tip_cents,
        terminal_id: params.terminal_id,
        valor_transaction_ref: authResult.transaction_ref,
        card_last_four: authResult.card_last_four,
        card_brand: authResult.card_brand,
        auth_code: authResult.auth_code,
        store_and_forward: true,
        created_at: new Date().toISOString(),
        staff_id: params.staff_id,
        location_id: params.location_id,
      },
      location_id: params.location_id,
    })

    // Update store-forward count
    await updateStoreForwardCounts(params.location_id)

    return {
      success: true,
      transaction_ref: authResult.transaction_ref,
      payment_id: paymentId,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process card on terminal.',
    }
  }
}

/**
 * Send a card payment request to the Valor terminal over local network.
 * Valor terminals expose a local API for processing.
 */
async function sendToValorTerminal(params: {
  terminal_ip: string
  terminal_port: number
  amount_cents: number
  tip_cents: number
}): Promise<ValorLocalAuth> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000) // 30s for card interaction

  try {
    const response = await fetch(`https://${params.terminal_ip}:${params.terminal_port}/api/sale`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: params.amount_cents,
        tip: params.tip_cents,
        store_and_forward: true,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? `Terminal returned ${response.status}`)
    }

    const result = await response.json()
    return {
      transaction_ref: result.transaction_ref ?? result.reference_number,
      amount_cents: params.amount_cents,
      tip_cents: params.tip_cents,
      terminal_id: '',
      card_last_four: result.card_last_four ?? '****',
      card_brand: result.card_brand ?? 'Unknown',
      auth_code: result.auth_code ?? '',
      created_at: new Date().toISOString(),
    }
  } catch (error) {
    clearTimeout(timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Card payment timed out. Customer may need to try again.')
    }
    throw error
  }
}

/**
 * Validate a manager's PIN for store-forward override.
 */
async function validateManagerPin(pin: string, locationId: string): Promise<boolean> {
  const { compare } = await import('bcryptjs')
  const managers = await offlineDB.staff
    .where('location_id')
    .equals(locationId)
    .filter((s) => s.is_active && ['owner', 'admin', 'manager'].includes(s.role) && s.pin_hash !== null)
    .toArray()

  for (const manager of managers) {
    if (!manager.pin_hash) continue
    const match = await compare(pin, manager.pin_hash)
    if (match) return true
  }
  return false
}

/**
 * Update store-forward counts in the offline store.
 */
async function updateStoreForwardCounts(locationId: string): Promise<void> {
  const entries = await offlineDB.sync_queue
    .where('status')
    .anyOf(['pending', 'syncing'])
    .filter((e) => e.operation === 'settle_payment' && e.location_id === locationId)
    .toArray()

  const count = entries.length
  const totalCents = entries.reduce((sum, e) => sum + ((e.payload.amount_cents as number) ?? 0), 0)

  const store = useOfflineStore.getState()
  store.actions.setStoreForwardCount(count, totalCents)
}

/**
 * Check settlement window: flag any store-forward payments older than 24hr.
 */
export async function checkSettlementWindow(): Promise<string[]> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const expired = await offlineDB.sync_queue
    .where('status')
    .equals('pending')
    .filter(
      (e) =>
        e.operation === 'settle_payment' &&
        e.created_at < twentyFourHoursAgo
    )
    .toArray()

  return expired.map((e) => e.id)
}

/**
 * Bar Tab Pre-Auth Lifecycle Manager
 *
 * Manages the full lifecycle of bar tabs:
 * - Open tab with pre-auth
 * - Track running totals against auth amounts
 * - Fire incremental auths when approaching auth limit
 * - Close tabs with tip capture
 * - Handle walkout captures with auto-gratuity
 * - Detect stale/idle tabs
 *
 * All money values are integer cents. Card data is NEVER stored —
 * only last4, brand, and processor tokens.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { getValorClient } from '@/lib/payments/valor-client-loader'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OpenTabParams {
  order_id: string
  terminal_id: string
  org_id: string
  location_id: string
  staff_id: string
  amount_cents?: number // Default from location settings, fallback $50
}

export interface OpenTabResult {
  success: boolean
  payment_id: string
  transaction_id: string
  auth_amount_cents: number
  card_last_four: string
  card_brand: string
  decline_reason?: string
}

export interface AddToTabParams {
  order_id: string
  org_id: string
  item_total_cents: number
}

export interface AddToTabResult {
  running_total_cents: number
  auth_amount_cents: number
  headroom_cents: number
  incremental_auth_fired: boolean
  new_auth_amount_cents?: number
  over_auth: boolean
}

export interface CloseTabParams {
  order_id: string
  org_id: string
  tip_cents: number
}

export interface CloseTabResult {
  success: boolean
  captured_amount_cents: number
  tip_cents: number
  transaction_id: string
}

export interface WalkoutCaptureParams {
  order_id: string
  org_id: string
  auto_gratuity_percent?: number // Default 20
}

export interface WalkoutCaptureResult {
  success: boolean
  captured_amount_cents: number
  auto_gratuity_cents: number
  transaction_id: string
}

export interface StaleTabInfo {
  order_id: string
  payment_id: string
  customer_name: string | null
  table_name: string | null
  running_total_cents: number
  auth_amount_cents: number
  last_item_added_at: string
  idle_hours: number
  card_last_four: string
  card_brand: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PREAUTH_CENTS = 5000 // $50
const MAX_PREAUTH_CENTS = 50000 // $500
const AUTH_HEADROOM_MULTIPLIER = 1.3 // 30% buffer for tax + tip
const DEFAULT_AUTO_GRATUITY_PERCENT = 20
const DEFAULT_IDLE_HOURS = 4
const PREAUTH_EXPIRY_DAYS = 7

// ---------------------------------------------------------------------------
// Bar Tab Manager
// ---------------------------------------------------------------------------

/**
 * Opens a new bar tab by initiating a pre-auth on the customer's card.
 * Stores token reference (last4 + brand), NEVER full PAN.
 */
export async function openTab(params: OpenTabParams): Promise<OpenTabResult> {
  const {
    order_id,
    terminal_id,
    org_id,
    location_id,
    staff_id,
    amount_cents,
  } = params

  const supabase = createAdminClient()

  // Get location default pre-auth amount if not specified
  let preauthAmount = amount_cents ?? DEFAULT_PREAUTH_CENTS
  if (preauthAmount > MAX_PREAUTH_CENTS) {
    preauthAmount = MAX_PREAUTH_CENTS
  }

  // Check for location-specific setting
  if (!amount_cents) {
    const { data: locationSettings } = await (supabase.from('location_settings') as ReturnType<typeof supabase.from>)
      .select('settings')
      .eq('location_id', location_id)
      .single()

    if (locationSettings) {
      const settings = locationSettings.settings as Record<string, unknown>
      if (typeof settings?.default_preauth_cents === 'number') {
        preauthAmount = Math.min(settings.default_preauth_cents as number, MAX_PREAUTH_CENTS)
      }
    }
  }

  // Verify order exists and is a bar type
  const { data: order, error: orderErr } = await (supabase.from('orders') as ReturnType<typeof supabase.from>)
    .select('id, org_id, order_type, status')
    .eq('id', order_id)
    .eq('org_id', org_id)
    .single()

  if (orderErr || !order) {
    return {
      success: false,
      payment_id: '',
      transaction_id: '',
      auth_amount_cents: 0,
      card_last_four: '',
      card_brand: '',
      decline_reason: 'Order not found',
    }
  }

  // Send pre-auth to Valor
  const valor = getValorClient()
  const authResult = await valor.preauth({
    amount_cents: preauthAmount,
    order_id,
    terminal_id,
  })

  // Create payment record (token only, NEVER full PAN)
  const paymentRecord = {
    org_id,
    location_id,
    order_id,
    payment_method: 'credit_card',
    amount: (preauthAmount / 100).toFixed(2),
    tip_amount: '0.00',
    total_amount: (preauthAmount / 100).toFixed(2),
    status: authResult.success ? 'authorized' : 'declined',
    card_last_four: authResult.card_last_four,
    card_brand: authResult.card_brand,
    auth_code: authResult.auth_code,
    reference_number: authResult.auth_code,
    processor_transaction_id: authResult.transaction_id,
    processor_response: {
      type: 'preauth',
      auth_amount_cents: preauthAmount,
      is_bar_tab: true,
      terminal_id,
    },
    processed_by: staff_id,
  }

  const { data: payment, error: paymentErr } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
    .insert(paymentRecord)
    .select('id')
    .single()

  if (paymentErr || !payment) {
    return {
      success: false,
      payment_id: '',
      transaction_id: authResult.transaction_id,
      auth_amount_cents: 0,
      card_last_four: '',
      card_brand: '',
      decline_reason: 'Failed to create payment record',
    }
  }

  // Update order status to open if it was draft
  if ((order as Record<string, unknown>).status === 'draft') {
    await (supabase.from('orders') as ReturnType<typeof supabase.from>)
      .update({ status: 'open' })
      .eq('id', order_id)
  }

  return {
    success: authResult.success,
    payment_id: (payment as Record<string, unknown>).id as string,
    transaction_id: authResult.transaction_id,
    auth_amount_cents: preauthAmount,
    card_last_four: authResult.card_last_four,
    card_brand: authResult.card_brand,
    decline_reason: authResult.decline_reason,
  }
}

/**
 * Checks running total against auth amount when items are added.
 * Fires incremental auth if running_total * 1.3 exceeds auth amount.
 */
export async function addToTab(params: AddToTabParams): Promise<AddToTabResult> {
  const { order_id, org_id, item_total_cents } = params
  const supabase = createAdminClient()

  // Get the active pre-auth payment for this order
  const { data: payment } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
    .select('*')
    .eq('order_id', order_id)
    .eq('org_id', org_id)
    .eq('status', 'authorized')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!payment) {
    // No active pre-auth — tab is running without card hold
    return {
      running_total_cents: item_total_cents,
      auth_amount_cents: 0,
      headroom_cents: 0,
      incremental_auth_fired: false,
      over_auth: true,
    }
  }

  const paymentData = payment as Record<string, unknown>
  const processorResponse = paymentData.processor_response as Record<string, unknown> | null
  const authAmountCents = (processorResponse?.auth_amount_cents as number) ??
    Math.round(parseFloat(paymentData.total_amount as string) * 100)

  // Calculate running total from order items
  const { data: order } = await (supabase.from('orders') as ReturnType<typeof supabase.from>)
    .select('subtotal_cents')
    .eq('id', order_id)
    .single()

  const runningTotal = order
    ? ((order as Record<string, unknown>).subtotal_cents as number) ?? item_total_cents
    : item_total_cents

  const headroom = authAmountCents - runningTotal
  const needsIncremental = runningTotal * AUTH_HEADROOM_MULTIPLIER > authAmountCents

  let incrementalFired = false
  let newAuthAmount = authAmountCents
  let overAuth = false

  if (needsIncremental) {
    // Calculate new auth amount: current running total * 2 (gives plenty of room)
    const additionalAmount = Math.max(authAmountCents, runningTotal * 2) - authAmountCents

    const valor = getValorClient()
    try {
      const incrementResult = await valor.incrementalAuth({
        transaction_id: paymentData.processor_transaction_id as string,
        additional_amount_cents: additionalAmount,
      })

      if (incrementResult.success) {
        incrementalFired = true
        newAuthAmount = authAmountCents + additionalAmount

        // Update the payment record with new auth amount
        await (supabase.from('payments') as ReturnType<typeof supabase.from>)
          .update({
            total_amount: (newAuthAmount / 100).toFixed(2),
            amount: (newAuthAmount / 100).toFixed(2),
            processor_response: {
              ...processorResponse,
              auth_amount_cents: newAuthAmount,
              incremental_auths: [
                ...((processorResponse?.incremental_auths as unknown[]) ?? []),
                {
                  additional_cents: additionalAmount,
                  new_total_cents: newAuthAmount,
                  timestamp: new Date().toISOString(),
                },
              ],
            },
          })
          .eq('id', paymentData.id)
      } else {
        // Incremental auth failed — flag as over auth but don't block service
        overAuth = true
      }
    } catch {
      // Network error — flag but don't block
      overAuth = true
    }
  }

  return {
    running_total_cents: runningTotal,
    auth_amount_cents: newAuthAmount,
    headroom_cents: newAuthAmount - runningTotal,
    incremental_auth_fired: incrementalFired,
    new_auth_amount_cents: incrementalFired ? newAuthAmount : undefined,
    over_auth: overAuth,
  }
}

/**
 * Closes a bar tab by capturing the final amount (subtotal + tax + tip).
 * Releases any excess authorization.
 */
export async function closeTab(params: CloseTabParams): Promise<CloseTabResult> {
  const { order_id, org_id, tip_cents } = params
  const supabase = createAdminClient()

  // Get the active pre-auth payment
  const { data: payment } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
    .select('*')
    .eq('order_id', order_id)
    .eq('org_id', org_id)
    .eq('status', 'authorized')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!payment) {
    return {
      success: false,
      captured_amount_cents: 0,
      tip_cents: 0,
      transaction_id: '',
    }
  }

  const paymentData = payment as Record<string, unknown>

  // Get order totals
  const { data: order } = await (supabase.from('orders') as ReturnType<typeof supabase.from>)
    .select('subtotal_cents, tax_cents, total_cents')
    .eq('id', order_id)
    .single()

  if (!order) {
    return {
      success: false,
      captured_amount_cents: 0,
      tip_cents: 0,
      transaction_id: '',
    }
  }

  const orderData = order as Record<string, unknown>
  const subtotalCents = (orderData.subtotal_cents as number) ?? 0
  const taxCents = (orderData.tax_cents as number) ?? 0
  const checkTotal = subtotalCents + taxCents
  const finalAmount = checkTotal + tip_cents

  // Capture via Valor
  const valor = getValorClient()
  const captureResult = await valor.capture({
    transaction_id: paymentData.processor_transaction_id as string,
    amount_cents: checkTotal,
    tip_cents,
  })

  if (!captureResult.success) {
    return {
      success: false,
      captured_amount_cents: 0,
      tip_cents: 0,
      transaction_id: paymentData.processor_transaction_id as string,
    }
  }

  // Update payment record
  await (supabase.from('payments') as ReturnType<typeof supabase.from>)
    .update({
      status: 'captured',
      amount: (checkTotal / 100).toFixed(2),
      tip_amount: (tip_cents / 100).toFixed(2),
      total_amount: (finalAmount / 100).toFixed(2),
      processor_response: {
        ...(paymentData.processor_response as Record<string, unknown>),
        capture: {
          captured_amount_cents: finalAmount,
          tip_cents,
          captured_at: new Date().toISOString(),
          type: 'tab_close',
        },
      },
    })
    .eq('id', paymentData.id)

  // Update order
  await (supabase.from('orders') as ReturnType<typeof supabase.from>)
    .update({
      status: 'closed',
      amount_paid: (finalAmount / 100).toFixed(2),
      balance_due: '0.00',
    })
    .eq('id', order_id)

  return {
    success: true,
    captured_amount_cents: finalAmount,
    tip_cents,
    transaction_id: paymentData.processor_transaction_id as string,
  }
}

/**
 * Captures a walkout tab at running total + tax + auto-gratuity.
 * Used when a customer leaves without closing their tab.
 */
export async function walkoutCapture(params: WalkoutCaptureParams): Promise<WalkoutCaptureResult> {
  const {
    order_id,
    org_id,
    auto_gratuity_percent = DEFAULT_AUTO_GRATUITY_PERCENT,
  } = params

  const supabase = createAdminClient()

  // Get active pre-auth
  const { data: payment } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
    .select('*')
    .eq('order_id', order_id)
    .eq('org_id', org_id)
    .eq('status', 'authorized')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!payment) {
    return {
      success: false,
      captured_amount_cents: 0,
      auto_gratuity_cents: 0,
      transaction_id: '',
    }
  }

  const paymentData = payment as Record<string, unknown>

  // Get order totals
  const { data: order } = await (supabase.from('orders') as ReturnType<typeof supabase.from>)
    .select('subtotal_cents, tax_cents')
    .eq('id', order_id)
    .single()

  if (!order) {
    return {
      success: false,
      captured_amount_cents: 0,
      auto_gratuity_cents: 0,
      transaction_id: '',
    }
  }

  const orderData = order as Record<string, unknown>
  const subtotalCents = (orderData.subtotal_cents as number) ?? 0
  const taxCents = (orderData.tax_cents as number) ?? 0
  const autoGratuityCents = Math.round(subtotalCents * (auto_gratuity_percent / 100))
  const finalAmount = subtotalCents + taxCents + autoGratuityCents

  // Capture via Valor
  const valor = getValorClient()
  const captureResult = await valor.capture({
    transaction_id: paymentData.processor_transaction_id as string,
    amount_cents: subtotalCents + taxCents,
    tip_cents: autoGratuityCents,
  })

  if (!captureResult.success) {
    return {
      success: false,
      captured_amount_cents: 0,
      auto_gratuity_cents: 0,
      transaction_id: paymentData.processor_transaction_id as string,
    }
  }

  // Update payment record
  await (supabase.from('payments') as ReturnType<typeof supabase.from>)
    .update({
      status: 'captured',
      amount: ((subtotalCents + taxCents) / 100).toFixed(2),
      tip_amount: (autoGratuityCents / 100).toFixed(2),
      total_amount: (finalAmount / 100).toFixed(2),
      processor_response: {
        ...(paymentData.processor_response as Record<string, unknown>),
        capture: {
          captured_amount_cents: finalAmount,
          auto_gratuity_cents: autoGratuityCents,
          auto_gratuity_percent,
          captured_at: new Date().toISOString(),
          type: 'walkout',
        },
      },
    })
    .eq('id', paymentData.id)

  // Update order
  await (supabase.from('orders') as ReturnType<typeof supabase.from>)
    .update({
      status: 'closed',
      amount_paid: (finalAmount / 100).toFixed(2),
      balance_due: '0.00',
      notes: 'Auto-closed: walkout capture with auto-gratuity',
    })
    .eq('id', order_id)

  return {
    success: true,
    captured_amount_cents: finalAmount,
    auto_gratuity_cents: autoGratuityCents,
    transaction_id: paymentData.processor_transaction_id as string,
  }
}

/**
 * Finds all idle bar tabs that have had no items added in the given number of hours.
 * Used by the stale tab checker worker.
 */
export async function findStaleTabs(
  org_id: string,
  location_id: string,
  idle_hours: number = DEFAULT_IDLE_HOURS
): Promise<StaleTabInfo[]> {
  const supabase = createAdminClient()

  const cutoff = new Date()
  cutoff.setHours(cutoff.getHours() - idle_hours)

  // Find open bar orders with authorized payments that are idle
  const { data: openBarOrders } = await (supabase.from('orders') as ReturnType<typeof supabase.from>)
    .select('id, order_number, table_id, table_name, subtotal_cents, updated_at, created_at, customer_name')
    .eq('org_id', org_id)
    .eq('location_id', location_id)
    .eq('order_type', 'bar')
    .in('status', ['open', 'fired'])
    .lt('updated_at', cutoff.toISOString())

  if (!openBarOrders || (openBarOrders as unknown[]).length === 0) {
    return []
  }

  const staleTabs: StaleTabInfo[] = []

  for (const order of openBarOrders as Record<string, unknown>[]) {
    // Find the authorized payment for this order
    const { data: payment } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
      .select('id, card_last_four, card_brand, total_amount, processor_response')
      .eq('order_id', order.id as string)
      .eq('status', 'authorized')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!payment) continue

    const paymentData = payment as Record<string, unknown>
    const processorResponse = paymentData.processor_response as Record<string, unknown> | null
    const authAmountCents = (processorResponse?.auth_amount_cents as number) ??
      Math.round(parseFloat(paymentData.total_amount as string) * 100)

    const lastActivity = new Date(order.updated_at as string)
    const idleMs = Date.now() - lastActivity.getTime()
    const idleHours = idleMs / (1000 * 60 * 60)

    staleTabs.push({
      order_id: order.id as string,
      payment_id: paymentData.id as string,
      customer_name: (order.customer_name as string) ?? null,
      table_name: (order.table_name as string) ?? null,
      running_total_cents: (order.subtotal_cents as number) ?? 0,
      auth_amount_cents: authAmountCents,
      last_item_added_at: order.updated_at as string,
      idle_hours: Math.round(idleHours * 10) / 10,
      card_last_four: (paymentData.card_last_four as string) ?? '',
      card_brand: (paymentData.card_brand as string) ?? '',
    })
  }

  return staleTabs
}

/**
 * Checks if a tab's pre-auth is approaching the 7-day expiry.
 * Returns tabs that will expire within the given number of days.
 */
export async function findExpiringPreAuths(
  org_id: string,
  days_until_expiry: number = 1
): Promise<StaleTabInfo[]> {
  const supabase = createAdminClient()

  const expiryThreshold = new Date()
  expiryThreshold.setDate(expiryThreshold.getDate() - (PREAUTH_EXPIRY_DAYS - days_until_expiry))

  // Find authorized payments older than threshold
  const { data: payments } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
    .select('id, order_id, card_last_four, card_brand, total_amount, processor_response, created_at')
    .eq('org_id', org_id)
    .eq('status', 'authorized')
    .lt('created_at', expiryThreshold.toISOString())

  if (!payments || (payments as unknown[]).length === 0) {
    return []
  }

  const expiringTabs: StaleTabInfo[] = []

  for (const payment of payments as Record<string, unknown>[]) {
    const { data: order } = await (supabase.from('orders') as ReturnType<typeof supabase.from>)
      .select('id, table_name, subtotal_cents, updated_at, customer_name')
      .eq('id', payment.order_id as string)
      .single()

    if (!order) continue

    const orderData = order as Record<string, unknown>
    const processorResponse = payment.processor_response as Record<string, unknown> | null
    const authAmountCents = (processorResponse?.auth_amount_cents as number) ??
      Math.round(parseFloat(payment.total_amount as string) * 100)

    const createdAt = new Date(payment.created_at as string)
    const ageHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60)

    expiringTabs.push({
      order_id: payment.order_id as string,
      payment_id: payment.id as string,
      customer_name: (orderData.customer_name as string) ?? null,
      table_name: (orderData.table_name as string) ?? null,
      running_total_cents: (orderData.subtotal_cents as number) ?? 0,
      auth_amount_cents: authAmountCents,
      last_item_added_at: orderData.updated_at as string,
      idle_hours: Math.round(ageHours * 10) / 10,
      card_last_four: (payment.card_last_four as string) ?? '',
      card_brand: (payment.card_brand as string) ?? '',
    })
  }

  return expiringTabs
}

/**
 * Webhook Event Dispatcher
 *
 * Dispatches events to subscribed webhook endpoints via BullMQ.
 * Handles: event matching, payload construction, delivery with retry,
 * and delivery logging.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { generateSignatureHeader } from './webhook-signature'
import { checkRateLimit } from './config-store'

const WEBHOOK_DAILY_LIMIT = 1000

export type WebhookEventType =
  | 'order.created'
  | 'order.updated'
  | 'order.closed'
  | 'payment.processed'
  | 'payment.refunded'
  | 'void.created'
  | 'comp.created'
  | 'employee.clocked_in'
  | 'employee.clocked_out'
  | 'item.86d'
  | 'item.un86d'
  | 'reservation.created'
  | 'reservation.cancelled'
  | 'table.status_changed'

export const WEBHOOK_EVENTS: Array<{ value: WebhookEventType; label: string; category: string }> = [
  { value: 'order.created', label: 'Order Created', category: 'Orders' },
  { value: 'order.updated', label: 'Order Updated', category: 'Orders' },
  { value: 'order.closed', label: 'Order Closed', category: 'Orders' },
  { value: 'payment.processed', label: 'Payment Processed', category: 'Payments' },
  { value: 'payment.refunded', label: 'Payment Refunded', category: 'Payments' },
  { value: 'void.created', label: 'Void Created', category: 'Payments' },
  { value: 'comp.created', label: 'Comp Created', category: 'Payments' },
  { value: 'employee.clocked_in', label: 'Employee Clocked In', category: 'Staff' },
  { value: 'employee.clocked_out', label: 'Employee Clocked Out', category: 'Staff' },
  { value: 'item.86d', label: 'Item 86\'d', category: 'Menu' },
  { value: 'item.un86d', label: 'Item Un-86\'d', category: 'Menu' },
  { value: 'reservation.created', label: 'Reservation Created', category: 'Reservations' },
  { value: 'reservation.cancelled', label: 'Reservation Cancelled', category: 'Reservations' },
  { value: 'table.status_changed', label: 'Table Status Changed', category: 'Tables' },
]

export interface WebhookEndpoint {
  id: string
  location_id: string
  name: string
  url: string
  secret: string
  events: WebhookEventType[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface WebhookPayload {
  event: WebhookEventType
  timestamp: string
  location_id: string
  data: unknown
}

export interface DeliverResult {
  success: boolean
  statusCode?: number
  responseTimeMs?: number
  error?: string
  logId?: string
}

/**
 * Get all active webhook endpoints subscribed to an event.
 */
export async function getSubscribedEndpoints(
  locationId: string,
  event: WebhookEventType
): Promise<WebhookEndpoint[]> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from('webhook_endpoints') as any)
    .select('*')
    .eq('location_id', locationId)
    .eq('is_active', true)
    .contains('events', [event])

  return data ?? []
}

/**
 * Dispatch an event to all subscribed webhooks.
 * In production, this would queue BullMQ jobs. Here we deliver directly.
 */
export async function dispatchEvent(
  locationId: string,
  event: WebhookEventType,
  data: unknown
): Promise<{ queued: number; endpoints: string[] }> {
  const endpoints = await getSubscribedEndpoints(locationId, event)
  if (endpoints.length === 0) {
    return { queued: 0, endpoints: [] }
  }

  const endpointNames: string[] = []
  for (const endpoint of endpoints) {
    // Rate limit check per endpoint
    const underLimit = await checkRateLimit(locationId, 'webhook', WEBHOOK_DAILY_LIMIT)
    if (!underLimit) continue

    // Queue delivery (in production would use BullMQ)
    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      location_id: locationId,
      data,
    }

    // Direct delivery (would be BullMQ job in production)
    deliverWebhook(endpoint, payload).catch(err => {
      console.error(`[webhook] Delivery failed for ${endpoint.name}:`, err)
    })

    endpointNames.push(endpoint.name)
  }

  return { queued: endpointNames.length, endpoints: endpointNames }
}

/**
 * Deliver a webhook payload to an endpoint.
 * Includes HMAC-SHA256 signature and delivery logging.
 */
export async function deliverWebhook(
  endpoint: WebhookEndpoint,
  payload: WebhookPayload,
  attempt: number = 1
): Promise<DeliverResult> {
  const payloadStr = JSON.stringify(payload)
  const signature = generateSignatureHeader(payloadStr, endpoint.secret)

  const startTime = Date.now()
  let statusCode: number | undefined
  let responseBody: string | undefined

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000) // 30s timeout

    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sear-Signature': signature,
        'X-Sear-Event': payload.event,
        'X-Sear-Delivery-Id': crypto.randomUUID(),
        'User-Agent': 'SearPOS-Webhook/1.0',
      },
      body: payloadStr,
      signal: controller.signal,
    })

    clearTimeout(timeout)
    statusCode = response.status
    responseBody = await response.text().catch(() => '')
    const responseTimeMs = Date.now() - startTime

    const success = statusCode >= 200 && statusCode < 300

    const logId = await logWebhookDelivery({
      endpointId: endpoint.id,
      locationId: endpoint.location_id,
      event: payload.event,
      url: endpoint.url,
      endpointName: endpoint.name,
      requestPayload: payloadStr,
      responseStatus: statusCode,
      responseBody: responseBody?.substring(0, 2000),
      responseTimeMs,
      status: success ? 'delivered' : (attempt < 3 ? 'retrying' : 'failed'),
      attempt,
    })

    if (!success && attempt < 3) {
      // Schedule retry with exponential backoff
      const delays = [60000, 300000, 1800000] // 1min, 5min, 30min
      const delay = delays[attempt - 1] ?? 60000
      setTimeout(() => {
        deliverWebhook(endpoint, payload, attempt + 1)
      }, delay)
    }

    return { success, statusCode, responseTimeMs, logId: logId ?? undefined }
  } catch (err) {
    const responseTimeMs = Date.now() - startTime
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'

    const logId = await logWebhookDelivery({
      endpointId: endpoint.id,
      locationId: endpoint.location_id,
      event: payload.event,
      url: endpoint.url,
      endpointName: endpoint.name,
      requestPayload: payloadStr,
      responseStatus: 0,
      responseBody: errorMsg,
      responseTimeMs,
      status: attempt < 3 ? 'retrying' : 'failed',
      attempt,
      error: errorMsg,
    })

    if (attempt < 3) {
      const delays = [60000, 300000, 1800000]
      const delay = delays[attempt - 1] ?? 60000
      setTimeout(() => {
        deliverWebhook(endpoint, payload, attempt + 1)
      }, delay)
    }

    return { success: false, error: errorMsg, responseTimeMs, logId: logId ?? undefined }
  }
}

/**
 * Log a webhook delivery attempt.
 */
async function logWebhookDelivery(params: {
  endpointId: string
  locationId: string
  event: string
  url: string
  endpointName: string
  requestPayload: string
  responseStatus: number
  responseBody?: string
  responseTimeMs: number
  status: 'delivered' | 'failed' | 'retrying'
  attempt: number
  error?: string
}): Promise<string | null> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('webhook_delivery_log') as any)
    .insert({
      webhook_endpoint_id: params.endpointId,
      location_id: params.locationId,
      event_type: params.event,
      endpoint_url: params.url,
      endpoint_name: params.endpointName,
      request_payload: params.requestPayload,
      response_status: params.responseStatus,
      response_body: params.responseBody,
      response_time_ms: params.responseTimeMs,
      status: params.status,
      attempt: params.attempt,
      error_message: params.error,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[webhook] Failed to log delivery:', error.message)
    return null
  }
  return data.id
}

/**
 * Send a test webhook to verify an endpoint.
 */
export async function testWebhookEndpoint(
  endpoint: WebhookEndpoint
): Promise<DeliverResult> {
  const payload: WebhookPayload = {
    event: 'order.created',
    timestamp: new Date().toISOString(),
    location_id: endpoint.location_id,
    data: {
      _test: true,
      message: 'This is a test webhook from Sear POS',
      order: {
        id: '00000000-0000-0000-0000-000000000000',
        order_number: 'TEST-001',
        order_type: 'dine_in',
        status: 'open',
        subtotal: 4150,
        tax: 332,
        total: 4482,
        items: [
          { name: 'Wagyu Burger', quantity: 2, price: 1800 },
          { name: 'Caesar Salad', quantity: 1, price: 550 },
        ],
      },
    },
  }

  return deliverWebhook(endpoint, payload, 3) // attempt=3 to skip retry on test
}

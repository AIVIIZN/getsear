/**
 * Webhook Delivery Worker
 *
 * BullMQ worker for delivering webhook events to subscribed endpoints.
 * Handles: retry with exponential backoff (1min, 5min, 30min).
 * Queue: webhook-delivery
 */

import { deliverWebhook, type WebhookEndpoint, type WebhookPayload } from '@/lib/integrations/webhook-dispatcher'

export const WEBHOOK_DELIVERY_QUEUE = 'webhook-delivery'

export interface WebhookDeliveryJobData {
  endpoint: WebhookEndpoint
  payload: WebhookPayload
  attempt: number
}

export interface WebhookDeliveryResult {
  success: boolean
  statusCode?: number
  responseTimeMs?: number
  error?: string
}

/**
 * Process a webhook delivery job.
 * On failure with attempt < 3, schedules a retry with backoff.
 */
export async function processWebhookDeliveryJob(
  data: WebhookDeliveryJobData
): Promise<WebhookDeliveryResult> {
  console.log(
    `[webhook-worker] Delivering ${data.payload.event} to ${data.endpoint.name} ` +
    `(attempt ${data.attempt}/3)`
  )

  const result = await deliverWebhook(
    data.endpoint,
    data.payload,
    data.attempt
  )

  if (result.success) {
    console.log(
      `[webhook-worker] Delivered successfully to ${data.endpoint.name} ` +
      `(${result.statusCode} in ${result.responseTimeMs}ms)`
    )
  } else {
    console.warn(
      `[webhook-worker] Delivery failed for ${data.endpoint.name}: ${result.error}`
    )
  }

  return {
    success: result.success,
    statusCode: result.statusCode,
    responseTimeMs: result.responseTimeMs,
    error: result.error,
  }
}

/**
 * Backoff delay configuration (milliseconds).
 * Attempt 1: 60s, Attempt 2: 300s, Attempt 3: 1800s
 */
export const RETRY_DELAYS = [60_000, 300_000, 1_800_000]

/**
 * Get the delay for a retry attempt.
 */
export function getRetryDelay(attempt: number): number {
  return RETRY_DELAYS[attempt - 1] ?? RETRY_DELAYS[RETRY_DELAYS.length - 1]
}

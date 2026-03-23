/**
 * SMS Delivery Worker
 *
 * BullMQ worker for sending SMS messages via Twilio.
 * Handles: order-ready, reservation reminders, waitlist alerts, marketing.
 * Queue: sms-delivery
 */

import { sendSms, type SendSmsParams } from '@/lib/integrations/twilio-client'
import type { SmsTemplateType } from '@/lib/integrations/sms-templates'

export const SMS_DELIVERY_QUEUE = 'sms-delivery'

export interface SmsDeliveryJobData {
  locationId: string
  to: string
  templateType: SmsTemplateType
  variables: Record<string, string>
  idempotencyKey?: string
  customBody?: string
}

export interface SmsDeliveryResult {
  success: boolean
  sid?: string
  error?: string
  logId?: string
}

/**
 * Process an SMS delivery job.
 */
export async function processSmsDeliveryJob(
  data: SmsDeliveryJobData
): Promise<SmsDeliveryResult> {
  console.log(`[sms-worker] Sending ${data.templateType} SMS to ${data.to.slice(-4)} for location ${data.locationId}`)

  const result = await sendSms({
    locationId: data.locationId,
    to: data.to,
    templateType: data.templateType,
    variables: data.variables,
    idempotencyKey: data.idempotencyKey,
    customBody: data.customBody,
  })

  if (result.success) {
    console.log(`[sms-worker] SMS sent successfully: ${result.sid}`)
  } else {
    console.warn(`[sms-worker] SMS failed: ${result.error}`)
  }

  return result
}

/**
 * Create job data for an order-ready SMS.
 * Called when KDS ticket is bumped for takeout/delivery/online orders.
 */
export function createOrderReadyJob(params: {
  locationId: string
  customerPhone: string
  customerName: string
  orderNumber: string
  locationName: string
  orderType: string
}): SmsDeliveryJobData {
  return {
    locationId: params.locationId,
    to: params.customerPhone,
    templateType: 'order_ready',
    variables: {
      customer_name: params.customerName,
      order_number: params.orderNumber,
      location_name: params.locationName,
      order_type: params.orderType,
    },
    idempotencyKey: `order_ready:${params.orderNumber}`,
  }
}

/**
 * Create job data for a waitlist alert SMS.
 * Called when host marks a table ready for a waitlist party.
 */
export function createWaitlistAlertJob(params: {
  locationId: string
  customerPhone: string
  customerName: string
  locationName: string
}): SmsDeliveryJobData {
  return {
    locationId: params.locationId,
    to: params.customerPhone,
    templateType: 'waitlist_alert',
    variables: {
      customer_name: params.customerName,
      location_name: params.locationName,
      wait_time: '10 minutes',
    },
    idempotencyKey: `waitlist_alert:${params.customerPhone}:${new Date().toISOString().split('T')[0]}`,
  }
}

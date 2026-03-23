/**
 * Email Delivery Worker
 *
 * BullMQ worker for sending emails via SendGrid.
 * Handles: receipts, daily reports, marketing, password reset, welcome.
 * Queue: email-delivery
 */

import { sendEmail, type SendEmailParams } from '@/lib/integrations/sendgrid-client'
import { renderReceiptEmail, type ReceiptData } from '@/lib/integrations/email-templates'

export const EMAIL_DELIVERY_QUEUE = 'email-delivery'

export interface EmailDeliveryJobData {
  locationId: string
  to: string
  subject: string
  html: string
  templateType: 'receipt' | 'daily_report' | 'marketing' | 'password_reset' | 'welcome'
  idempotencyKey?: string
  metadata?: Record<string, string>
}

export interface EmailDeliveryResult {
  success: boolean
  messageId?: string
  error?: string
  logId?: string
}

/**
 * Process an email delivery job.
 */
export async function processEmailDeliveryJob(
  data: EmailDeliveryJobData
): Promise<EmailDeliveryResult> {
  console.log(`[email-worker] Sending ${data.templateType} email to ${data.to} for location ${data.locationId}`)

  const result = await sendEmail({
    locationId: data.locationId,
    to: data.to,
    subject: data.subject,
    html: data.html,
    templateType: data.templateType,
    idempotencyKey: data.idempotencyKey,
    metadata: data.metadata,
  })

  if (result.success) {
    console.log(`[email-worker] Email sent successfully: ${result.messageId}`)
  } else {
    console.warn(`[email-worker] Email failed: ${result.error}`)
  }

  return result
}

/**
 * Create job data for a receipt email.
 * Called after payment processing.
 */
export function createReceiptEmailJob(params: {
  locationId: string
  to: string
  receiptData: ReceiptData
  orderId: string
}): EmailDeliveryJobData {
  const { subject, html } = renderReceiptEmail(params.receiptData)
  return {
    locationId: params.locationId,
    to: params.to,
    subject,
    html,
    templateType: 'receipt',
    idempotencyKey: `receipt:${params.orderId}:${params.to}`,
    metadata: { order_id: params.orderId },
  }
}

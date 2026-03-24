/**
 * SendGrid Client Wrapper
 *
 * Wraps the SendGrid v3 REST API with error handling, rate limiting,
 * delivery logging, and duplicate prevention.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { getIntegrationConfig, checkRateLimit } from './config-store'

const EMAIL_DAILY_LIMIT = 500

export interface SendGridConfig {
  api_key: string
  sender_email: string
  sender_name: string
  reply_to?: string
  notifications: {
    receipts: boolean
    daily_reports: boolean
    marketing: boolean
    password_reset: boolean
  }
}

export interface SendEmailParams {
  locationId: string
  to: string
  subject: string
  html: string
  templateType: 'receipt' | 'daily_report' | 'marketing' | 'password_reset' | 'welcome'
  idempotencyKey?: string
  metadata?: Record<string, string>
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
  logId?: string
}

/**
 * Get SendGrid config for a location. Returns null if not configured.
 */
export async function getSendGridConfig(locationId: string): Promise<SendGridConfig | null> {
  const config = await getIntegrationConfig(locationId, 'sendgrid')
  if (!config || !config.is_active) return null

  const c = config.config as Record<string, unknown>
  if (!c.api_key || !c.sender_email) return null

  return {
    api_key: c.api_key as string,
    sender_email: c.sender_email as string,
    sender_name: (c.sender_name as string) ?? 'Sear POS',
    reply_to: c.reply_to as string | undefined,
    notifications: (c.notifications as SendGridConfig['notifications']) ?? {
      receipts: true,
      daily_reports: true,
      marketing: false,
      password_reset: true,
    },
  }
}

/**
 * Mask an email for display in logs.
 * Format: j***@email.com
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return '***@***'
  return `${local[0]}***@${domain}`
}

/**
 * Check for duplicate email delivery (idempotent sends).
 */
async function isDuplicate(locationId: string, idempotencyKey: string): Promise<boolean> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from('email_delivery_log') as any)
    .select('id')
    .eq('location_id', locationId)
    .eq('idempotency_key', idempotencyKey)
    .in('status', ['delivered', 'sent', 'pending'])
    .maybeSingle()

  return data !== null
}

/**
 * Log an email delivery attempt.
 */
async function logDelivery(params: {
  locationId: string
  to: string
  templateType: string
  subject: string
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'bounced' | 'failed'
  sendgridMessageId?: string
  error?: string
  idempotencyKey?: string
}): Promise<string | null> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('email_delivery_log') as any)
    .insert({
      location_id: params.locationId,
      recipient_email: params.to,
      template_type: params.templateType,
      subject: params.subject,
      status: params.status,
      sendgrid_message_id: params.sendgridMessageId,
      error_message: params.error,
      idempotency_key: params.idempotencyKey,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[sendgrid] Failed to log delivery:', error.message)
    return null
  }
  return data.id
}

/**
 * Send an email via SendGrid v3 API.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  try {
    // 1. Get config
    const config = await getSendGridConfig(params.locationId)
    if (!config) {
      return { success: false, error: 'SendGrid not configured' }
    }

    // 2. Check notification type is enabled
    const notifKey = params.templateType === 'receipt' ? 'receipts' : params.templateType
    if (notifKey in config.notifications && !config.notifications[notifKey as keyof typeof config.notifications]) {
      return { success: false, error: `Email type ${params.templateType} is disabled` }
    }

    // 3. Rate limit
    const underLimit = await checkRateLimit(params.locationId, 'email', EMAIL_DAILY_LIMIT)
    if (!underLimit) {
      return { success: false, error: 'Daily email limit reached' }
    }

    // 4. Duplicate check
    if (params.idempotencyKey) {
      const dup = await isDuplicate(params.locationId, params.idempotencyKey)
      if (dup) {
        return { success: false, error: 'Duplicate email — already sent' }
      }
    }

    // 5. Send via SendGrid v3 API
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: params.to }],
            custom_args: {
              location_id: params.locationId,
              template_type: params.templateType,
              ...(params.metadata ?? {}),
            },
          },
        ],
        from: {
          email: config.sender_email,
          name: config.sender_name,
        },
        reply_to: config.reply_to ? { email: config.reply_to } : undefined,
        subject: params.subject,
        content: [{ type: 'text/html', value: params.html }],
        tracking_settings: {
          open_tracking: { enable: true },
          click_tracking: { enable: true },
        },
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      let errorMsg = 'SendGrid API error'
      try {
        const parsed = JSON.parse(errorBody)
        errorMsg = parsed.errors?.[0]?.message ?? errorMsg
      } catch {
        // use default
      }

      const logId = await logDelivery({
        locationId: params.locationId,
        to: params.to,
        templateType: params.templateType,
        subject: params.subject,
        status: 'failed',
        error: errorMsg,
        idempotencyKey: params.idempotencyKey,
      })
      return { success: false, error: errorMsg, logId: logId ?? undefined }
    }

    const messageId = response.headers.get('x-message-id') ?? undefined

    const logId = await logDelivery({
      locationId: params.locationId,
      to: params.to,
      templateType: params.templateType,
      subject: params.subject,
      status: 'sent',
      sendgridMessageId: messageId,
      idempotencyKey: params.idempotencyKey,
    })

    return { success: true, messageId, logId: logId ?? undefined }
  } catch (err) {
    console.error('[sendgrid] Send error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error sending email',
    }
  }
}

/**
 * Test SendGrid connection by sending a test email.
 */
export async function testSendGridConnection(
  apiKey: string,
  senderEmail: string,
  senderName: string,
  testTo: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: testTo }] }],
        from: { email: senderEmail, name: senderName },
        subject: 'Sear POS — Email Integration Test',
        content: [{
          type: 'text/html',
          value: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
              <div style="background: #007AFF; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Sear POS</h1>
              </div>
              <div style="background: white; padding: 32px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
                <h2 style="margin-top: 0; color: #1C1C1E;">Email Integration Connected!</h2>
                <p style="color: #78756D; line-height: 1.6;">Your SendGrid integration is working correctly. You can now send receipts, daily reports, and marketing emails through Sear POS.</p>
                <p style="color: #78756D; font-size: 14px; margin-top: 24px;">This is a test message from your Sear POS system.</p>
              </div>
            </div>
          `,
        }],
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      let errorMsg = `HTTP ${response.status}`
      try {
        const parsed = JSON.parse(errorBody)
        errorMsg = parsed.errors?.[0]?.message ?? errorMsg
      } catch {
        // use status code
      }
      return { success: false, error: errorMsg }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Connection failed' }
  }
}

/**
 * Update email delivery status from SendGrid event webhook.
 */
export async function updateEmailStatus(
  sendgridMessageId: string,
  event: 'delivered' | 'open' | 'bounce' | 'dropped' | 'deferred'
): Promise<void> {
  const supabase = createAdminClient()

  const statusMap: Record<string, string> = {
    delivered: 'delivered',
    open: 'opened',
    bounce: 'bounced',
    dropped: 'failed',
    deferred: 'pending',
  }

  const status = statusMap[event] ?? event

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('email_delivery_log') as any)
    .update({ status, updated_at: new Date().toISOString() })
    .eq('sendgrid_message_id', sendgridMessageId)
}

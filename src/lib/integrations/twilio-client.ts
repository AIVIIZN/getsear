/**
 * Twilio Client Wrapper
 *
 * Wraps the Twilio SDK with error handling, rate limiting, opt-out checking,
 * duplicate prevention, and delivery logging.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { getIntegrationConfig, checkRateLimit } from './config-store'
import { renderTemplate, type SmsTemplateType } from './sms-templates'

const SMS_DAILY_LIMIT = 100

export interface TwilioConfig {
  account_sid: string
  auth_token: string
  phone_number: string
  notifications: {
    order_ready: boolean
    reservation_reminder: boolean
    waitlist_alert: boolean
    marketing: boolean
  }
}

export interface SendSmsParams {
  locationId: string
  to: string
  templateType: SmsTemplateType
  variables: Record<string, string>
  idempotencyKey?: string
  customBody?: string
}

export interface SendSmsResult {
  success: boolean
  sid?: string
  error?: string
  logId?: string
}

/**
 * Get Twilio config for a location. Returns null if not configured.
 */
export async function getTwilioConfig(locationId: string): Promise<TwilioConfig | null> {
  const config = await getIntegrationConfig(locationId, 'twilio')
  if (!config || !config.is_active) return null

  const c = config.config as Record<string, unknown>
  if (!c.account_sid || !c.auth_token || !c.phone_number) return null

  return {
    account_sid: c.account_sid as string,
    auth_token: c.auth_token as string,
    phone_number: c.phone_number as string,
    notifications: (c.notifications as TwilioConfig['notifications']) ?? {
      order_ready: true,
      reservation_reminder: true,
      waitlist_alert: true,
      marketing: false,
    },
  }
}

/**
 * Check if a phone number has opted out of SMS.
 */
export async function isOptedOut(phone: string): Promise<boolean> {
  const supabase = createAdminClient()
  const normalized = normalizePhone(phone)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from('sms_opt_outs') as any)
    .select('id')
    .eq('phone', normalized)
    .maybeSingle()

  return data !== null
}

/**
 * Add a phone number to the opt-out list.
 */
export async function addOptOut(phone: string): Promise<void> {
  const supabase = createAdminClient()
  const normalized = normalizePhone(phone)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('sms_opt_outs') as any)
    .upsert({ phone: normalized, opted_out_at: new Date().toISOString() }, { onConflict: 'phone' })
}

/**
 * Remove a phone number from the opt-out list (re-subscribe).
 */
export async function removeOptOut(phone: string): Promise<void> {
  const supabase = createAdminClient()
  const normalized = normalizePhone(phone)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('sms_opt_outs') as any)
    .delete()
    .eq('phone', normalized)
}

/**
 * Normalize a phone number to E.164 format.
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (digits.startsWith('+')) return phone.replace(/\s/g, '')
  return `+${digits}`
}

/**
 * Check for duplicate SMS delivery (idempotent sends).
 */
async function isDuplicate(locationId: string, idempotencyKey: string): Promise<boolean> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from('sms_delivery_log') as any)
    .select('id')
    .eq('location_id', locationId)
    .eq('idempotency_key', idempotencyKey)
    .in('status', ['delivered', 'sent', 'pending'])
    .maybeSingle()

  return data !== null
}

/**
 * Log an SMS delivery attempt.
 */
async function logDelivery(params: {
  locationId: string
  to: string
  templateType: SmsTemplateType
  body: string
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'opted_out'
  twilioSid?: string
  error?: string
  idempotencyKey?: string
}): Promise<string | null> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('sms_delivery_log') as any)
    .insert({
      location_id: params.locationId,
      recipient_phone: params.to,
      template_type: params.templateType,
      message_body: params.body,
      status: params.status,
      twilio_sid: params.twilioSid,
      error_message: params.error,
      idempotency_key: params.idempotencyKey,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[twilio] Failed to log delivery:', error.message)
    return null
  }
  return data.id
}

/**
 * Send an SMS message via Twilio.
 * Handles: config check, opt-out check, rate limiting, duplicate prevention, logging.
 */
export async function sendSms(params: SendSmsParams): Promise<SendSmsResult> {
  try {
    // 1. Get config — silently skip if not configured
    const config = await getTwilioConfig(params.locationId)
    if (!config) {
      return { success: false, error: 'Twilio not configured' }
    }

    // 2. Check if notification type is enabled
    const notifKey = params.templateType === 'reservation_reminder_24hr' || params.templateType === 'reservation_reminder_2hr'
      ? 'reservation_reminder'
      : params.templateType
    if (notifKey in config.notifications && !config.notifications[notifKey as keyof typeof config.notifications]) {
      return { success: false, error: `Notification type ${params.templateType} is disabled` }
    }

    // 3. Check opt-out (always check for marketing, optionally for transactional)
    const normalizedTo = normalizePhone(params.to)
    if (params.templateType === 'marketing') {
      const optedOut = await isOptedOut(normalizedTo)
      if (optedOut) {
        await logDelivery({
          locationId: params.locationId,
          to: normalizedTo,
          templateType: params.templateType,
          body: '',
          status: 'opted_out',
          idempotencyKey: params.idempotencyKey,
        })
        return { success: false, error: 'Recipient has opted out' }
      }
    }

    // 4. Rate limit check
    const underLimit = await checkRateLimit(params.locationId, 'sms', SMS_DAILY_LIMIT)
    if (!underLimit) {
      return { success: false, error: 'Daily SMS limit reached' }
    }

    // 5. Duplicate check
    if (params.idempotencyKey) {
      const dup = await isDuplicate(params.locationId, params.idempotencyKey)
      if (dup) {
        return { success: false, error: 'Duplicate message — already sent' }
      }
    }

    // 6. Get template and render
    const supabase = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: template } = await (supabase.from('sms_templates') as any)
      .select('body')
      .eq('location_id', params.locationId)
      .eq('template_type', params.templateType)
      .eq('is_active', true)
      .maybeSingle()

    const body = params.customBody ?? renderTemplate(
      template?.body ?? getDefaultBody(params.templateType),
      params.variables
    )

    // 7. Send via Twilio REST API (avoid SDK dependency for server bundle)
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${config.account_sid}/Messages.json`
    const auth = Buffer.from(`${config.account_sid}:${config.auth_token}`).toString('base64')

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: normalizedTo,
        From: config.phone_number,
        Body: body,
      }).toString(),
    })

    const result = await response.json()

    if (!response.ok) {
      const errorMsg = result.message ?? result.error_message ?? 'Unknown Twilio error'
      const logId = await logDelivery({
        locationId: params.locationId,
        to: normalizedTo,
        templateType: params.templateType,
        body,
        status: 'failed',
        error: errorMsg,
        idempotencyKey: params.idempotencyKey,
      })
      return { success: false, error: errorMsg, logId: logId ?? undefined }
    }

    const logId = await logDelivery({
      locationId: params.locationId,
      to: normalizedTo,
      templateType: params.templateType,
      body,
      status: 'sent',
      twilioSid: result.sid,
      idempotencyKey: params.idempotencyKey,
    })

    return { success: true, sid: result.sid, logId: logId ?? undefined }
  } catch (err) {
    console.error('[twilio] Send error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error sending SMS',
    }
  }
}

function getDefaultBody(type: SmsTemplateType): string {
  const defaults: Record<SmsTemplateType, string> = {
    order_ready: 'Hi {{customer_name}}, your order #{{order_number}} is ready for pickup at {{location_name}}!',
    reservation_reminder_24hr: 'Reminder: You have a reservation at {{location_name}} {{reservation_date}} at {{reservation_time}} for {{party_size}} guests. Reply C to confirm or X to cancel.',
    reservation_reminder_2hr: 'Your table at {{location_name}} is ready in 2 hours ({{reservation_time}}). See you soon!',
    waitlist_alert: 'Great news, {{customer_name}}! Your table at {{location_name}} is ready. Please check in within {{wait_time}} or your spot may be given to the next party.',
    marketing: 'Hi {{customer_name}}! {{offer}} at {{location_name}}. Reply STOP to unsubscribe',
  }
  return defaults[type]
}

/**
 * Test Twilio connection by sending a test SMS.
 */
export async function testTwilioConnection(
  accountSid: string,
  authToken: string,
  phoneNumber: string,
  testTo: string
): Promise<{ success: boolean; error?: string; sid?: string }> {
  try {
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: normalizePhone(testTo),
        From: phoneNumber,
        Body: 'Sear POS: Test SMS connection successful! Your Twilio integration is working.',
      }).toString(),
    })

    const result = await response.json()

    if (!response.ok) {
      return { success: false, error: result.message ?? 'Twilio API error' }
    }

    return { success: true, sid: result.sid }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Connection failed' }
  }
}

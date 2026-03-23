/**
 * Campaign dispatch for Sear POS Marketing module.
 * Sends SMS via Twilio and email via SendGrid.
 */

import { resolveMergeFields, type MergeFieldData } from './merge-fields'

export interface CampaignRecipient {
  customer_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  points_balance: number
  tier: string
  last_visit: string | null
  total_visits: number
  total_spent: string
}

export interface CampaignContent {
  channel: 'sms' | 'email' | 'both'
  sms_body?: string
  email_subject?: string
  email_body?: string
}

export interface SendResult {
  total_recipients: number
  sms_sent: number
  sms_failed: number
  email_sent: number
  email_failed: number
  errors: string[]
}

/**
 * Send SMS via Twilio.
 */
async function sendSMS(to: string, body: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_FROM_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    console.warn('Twilio not configured — skipping SMS send')
    return false
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: to.startsWith('+') ? to : `+1${to.replace(/\D/g, '')}`,
          From: fromNumber,
          Body: body,
        }),
      }
    )
    return response.ok
  } catch (err) {
    console.error('SMS send error:', err)
    return false
  }
}

/**
 * Send email via SendGrid.
 */
async function sendEmail(to: string, subject: string, htmlBody: string, fromName: string): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY
  const fromEmail = process.env.SENDGRID_FROM_EMAIL ?? 'noreply@getsear.com'

  if (!apiKey) {
    console.warn('SendGrid not configured — skipping email send')
    return false
  }

  // Add unsubscribe footer for CAN-SPAM compliance
  const bodyWithUnsubscribe = `${htmlBody}
<hr style="margin-top: 32px; border: none; border-top: 1px solid #e5e5e5;" />
<p style="font-size: 11px; color: #888; text-align: center;">
  You are receiving this email because you opted in at ${fromName}.<br/>
  <a href="{unsubscribe_url}" style="color: #888;">Unsubscribe</a>
</p>`

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: fromEmail, name: fromName },
        subject,
        content: [{ type: 'text/html', value: bodyWithUnsubscribe }],
      }),
    })
    return response.ok || response.status === 202
  } catch (err) {
    console.error('Email send error:', err)
    return false
  }
}

/**
 * Send a campaign to all recipients.
 */
export async function sendCampaign(
  content: CampaignContent,
  recipients: CampaignRecipient[],
  restaurantName: string,
  locationName: string
): Promise<SendResult> {
  const result: SendResult = {
    total_recipients: recipients.length,
    sms_sent: 0,
    sms_failed: 0,
    email_sent: 0,
    email_failed: 0,
    errors: [],
  }

  for (const recipient of recipients) {
    const mergeData: Partial<MergeFieldData> = {
      first_name: recipient.first_name || 'Guest',
      last_name: recipient.last_name || '',
      full_name: `${recipient.first_name ?? ''} ${recipient.last_name ?? ''}`.trim() || 'Guest',
      email: recipient.email ?? '',
      phone: recipient.phone ?? '',
      points_balance: recipient.points_balance,
      tier: recipient.tier,
      last_visit: recipient.last_visit
        ? new Date(recipient.last_visit).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
        : 'recently',
      total_visits: recipient.total_visits,
      total_spent: recipient.total_spent,
      restaurant_name: restaurantName,
      location_name: locationName,
    }

    // Send SMS
    if ((content.channel === 'sms' || content.channel === 'both') && content.sms_body && recipient.phone) {
      const smsBody = resolveMergeFields(content.sms_body, mergeData)
      const success = await sendSMS(recipient.phone, smsBody)
      if (success) result.sms_sent++
      else result.sms_failed++
    }

    // Send Email
    if ((content.channel === 'email' || content.channel === 'both') && content.email_subject && content.email_body && recipient.email) {
      const subject = resolveMergeFields(content.email_subject, mergeData)
      const body = resolveMergeFields(content.email_body, mergeData)
      const success = await sendEmail(recipient.email, subject, body, restaurantName)
      if (success) result.email_sent++
      else result.email_failed++
    }
  }

  return result
}

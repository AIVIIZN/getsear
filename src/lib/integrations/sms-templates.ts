/**
 * SMS Template Engine
 *
 * Default templates and merge variable rendering for all SMS notification types.
 * Templates use {{variable}} syntax for merge variables.
 */

export type SmsTemplateType =
  | 'order_ready'
  | 'reservation_reminder_24hr'
  | 'reservation_reminder_2hr'
  | 'waitlist_alert'
  | 'marketing'

export interface SmsTemplate {
  id: string
  location_id: string
  template_type: SmsTemplateType
  name: string
  body: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface MergeVariable {
  key: string
  label: string
  sample: string
}

export const MERGE_VARIABLES: Record<SmsTemplateType, MergeVariable[]> = {
  order_ready: [
    { key: 'customer_name', label: 'Customer Name', sample: 'Sarah' },
    { key: 'order_number', label: 'Order Number', sample: '1047' },
    { key: 'location_name', label: 'Location Name', sample: 'Sear Grill Downtown' },
    { key: 'order_type', label: 'Order Type', sample: 'Takeout' },
  ],
  reservation_reminder_24hr: [
    { key: 'customer_name', label: 'Customer Name', sample: 'Michael' },
    { key: 'location_name', label: 'Location Name', sample: 'Sear Grill Downtown' },
    { key: 'reservation_time', label: 'Reservation Time', sample: '7:00 PM' },
    { key: 'reservation_date', label: 'Reservation Date', sample: 'tomorrow' },
    { key: 'party_size', label: 'Party Size', sample: '4' },
  ],
  reservation_reminder_2hr: [
    { key: 'customer_name', label: 'Customer Name', sample: 'Michael' },
    { key: 'location_name', label: 'Location Name', sample: 'Sear Grill Downtown' },
    { key: 'reservation_time', label: 'Reservation Time', sample: '7:00 PM' },
  ],
  waitlist_alert: [
    { key: 'customer_name', label: 'Customer Name', sample: 'Jessica' },
    { key: 'location_name', label: 'Location Name', sample: 'Sear Grill Downtown' },
    { key: 'wait_time', label: 'Wait Time', sample: '10 minutes' },
  ],
  marketing: [
    { key: 'customer_name', label: 'Customer Name', sample: 'Valued Guest' },
    { key: 'location_name', label: 'Location Name', sample: 'Sear Grill Downtown' },
    { key: 'offer', label: 'Offer Details', sample: '20% off your next visit' },
  ],
}

export const DEFAULT_TEMPLATES: Record<SmsTemplateType, { name: string; body: string }> = {
  order_ready: {
    name: 'Order Ready',
    body: 'Hi {{customer_name}}, your order #{{order_number}} is ready for pickup at {{location_name}}!',
  },
  reservation_reminder_24hr: {
    name: 'Reservation Reminder (24hr)',
    body: 'Reminder: You have a reservation at {{location_name}} {{reservation_date}} at {{reservation_time}} for {{party_size}} guests. Reply C to confirm or X to cancel.',
  },
  reservation_reminder_2hr: {
    name: 'Reservation Reminder (2hr)',
    body: 'Your table at {{location_name}} is ready in 2 hours ({{reservation_time}}). See you soon!',
  },
  waitlist_alert: {
    name: 'Waitlist Alert',
    body: 'Great news, {{customer_name}}! Your table at {{location_name}} is ready. Please check in within {{wait_time}} or your spot may be given to the next party.',
  },
  marketing: {
    name: 'Marketing Campaign',
    body: 'Hi {{customer_name}}! {{offer}} at {{location_name}}. Reply STOP to unsubscribe',
  },
}

/**
 * Render a template body with merge variables.
 * Replaces all {{variable}} tokens with the provided values.
 */
export function renderTemplate(
  body: string,
  variables: Record<string, string>
): string {
  let rendered = body
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }
  return rendered
}

/**
 * Render a template with sample data for preview.
 */
export function renderPreview(
  body: string,
  templateType: SmsTemplateType
): string {
  const variables = MERGE_VARIABLES[templateType]
  const sampleData: Record<string, string> = {}
  for (const v of variables) {
    sampleData[v.key] = v.sample
  }
  return renderTemplate(body, sampleData)
}

/**
 * Count SMS segments. Standard SMS is 160 chars (GSM-7) or 70 chars (UCS-2).
 * Returns { chars, segments, encoding }.
 */
export function countSmsSegments(text: string): {
  chars: number
  segments: number
  encoding: 'GSM-7' | 'UCS-2'
  maxPerSegment: number
} {
  const gsm7Regex = /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ ÆæßÉ!"#¤%&'()*+,\-.\/0-9:;<=>?¡A-Za-zÄÖÑÜ§¿äöñüà\^{}\[\]~|€]*$/
  const isGsm7 = gsm7Regex.test(text)

  if (isGsm7) {
    const maxPerSegment = text.length <= 160 ? 160 : 153
    return {
      chars: text.length,
      segments: text.length <= 160 ? 1 : Math.ceil(text.length / 153),
      encoding: 'GSM-7',
      maxPerSegment,
    }
  }

  const maxPerSegment = text.length <= 70 ? 70 : 67
  return {
    chars: text.length,
    segments: text.length <= 70 ? 1 : Math.ceil(text.length / 67),
    encoding: 'UCS-2',
    maxPerSegment,
  }
}

/**
 * Validate that a marketing SMS includes opt-out language.
 */
export function hasOptOutText(body: string): boolean {
  const lower = body.toLowerCase()
  return lower.includes('stop') && (lower.includes('reply') || lower.includes('text'))
}

/**
 * Mask a phone number for display in logs.
 * Format: ***-***-1234
 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return '***'
  return `***-***-${digits.slice(-4)}`
}

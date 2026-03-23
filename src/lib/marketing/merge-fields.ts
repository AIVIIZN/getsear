/**
 * Marketing merge field resolution for Sear POS.
 * Replaces template merge fields with actual customer data.
 */

export interface MergeFieldData {
  first_name: string
  last_name: string
  full_name: string
  email: string
  phone: string
  points_balance: number
  tier: string
  last_visit: string
  total_visits: number
  total_spent: string
  restaurant_name: string
  location_name: string
}

export const AVAILABLE_MERGE_FIELDS = [
  { key: '{first_name}', label: 'First Name', example: 'Sarah' },
  { key: '{last_name}', label: 'Last Name', example: 'Johnson' },
  { key: '{full_name}', label: 'Full Name', example: 'Sarah Johnson' },
  { key: '{points_balance}', label: 'Points Balance', example: '1,250' },
  { key: '{tier}', label: 'Loyalty Tier', example: 'Gold' },
  { key: '{last_visit}', label: 'Last Visit', example: 'March 15' },
  { key: '{total_visits}', label: 'Total Visits', example: '24' },
  { key: '{total_spent}', label: 'Total Spent', example: '$1,842.50' },
  { key: '{restaurant_name}', label: 'Restaurant Name', example: 'The Ember Grill' },
  { key: '{location_name}', label: 'Location Name', example: 'Downtown' },
]

/**
 * Resolve merge fields in a template string.
 */
export function resolveMergeFields(template: string, data: Partial<MergeFieldData>): string {
  let result = template
  result = result.replace(/{first_name}/g, data.first_name ?? 'Guest')
  result = result.replace(/{last_name}/g, data.last_name ?? '')
  result = result.replace(/{full_name}/g, data.full_name ?? data.first_name ?? 'Guest')
  result = result.replace(/{email}/g, data.email ?? '')
  result = result.replace(/{phone}/g, data.phone ?? '')
  result = result.replace(/{points_balance}/g, (data.points_balance ?? 0).toLocaleString())
  result = result.replace(/{tier}/g, data.tier ?? '')
  result = result.replace(/{last_visit}/g, data.last_visit ?? 'recently')
  result = result.replace(/{total_visits}/g, (data.total_visits ?? 0).toString())
  result = result.replace(/{total_spent}/g, data.total_spent ?? '$0.00')
  result = result.replace(/{restaurant_name}/g, data.restaurant_name ?? 'Our Restaurant')
  result = result.replace(/{location_name}/g, data.location_name ?? '')
  return result
}

/**
 * Pre-built marketing templates.
 */
export const MARKETING_TEMPLATES = [
  {
    id: 'new-menu-item',
    name: 'New Menu Item',
    channel: 'both' as const,
    sms_body: 'Hey {first_name}! We just added something new to the menu at {restaurant_name}. Come try it before everyone else! Reply STOP to opt out.',
    email_subject: 'Something New Just Landed at {restaurant_name}',
    email_body: `<p>Hi {first_name},</p>
<p>We're excited to share that we've just added a brand new dish to our menu at {restaurant_name}.</p>
<p>As one of our valued guests, we wanted you to be among the first to know.</p>
<p>Come visit us soon and be one of the first to try it!</p>
<p>See you soon,<br/>{restaurant_name}</p>`,
  },
  {
    id: 'happy-hour',
    name: 'Happy Hour Special',
    channel: 'sms' as const,
    sms_body: '{first_name}, happy hour at {restaurant_name} today! Special pricing from 4-6pm. See you there! Reply STOP to opt out.',
    email_subject: 'Happy Hour at {restaurant_name} - Today!',
    email_body: `<p>Hi {first_name},</p>
<p>Join us for happy hour today from 4-6pm at {restaurant_name} {location_name}.</p>
<p>Special pricing on select drinks and appetizers.</p>
<p>See you there!</p>`,
  },
  {
    id: 'holiday-hours',
    name: 'Holiday Hours',
    channel: 'both' as const,
    sms_body: 'Hi {first_name}, {restaurant_name} holiday hours update: We will be [HOURS]. Happy holidays! Reply STOP to opt out.',
    email_subject: 'Holiday Hours at {restaurant_name}',
    email_body: `<p>Hi {first_name},</p>
<p>We wanted to let you know about our holiday hours at {restaurant_name}:</p>
<p><strong>[Insert holiday schedule here]</strong></p>
<p>Wishing you and your family a wonderful holiday season!</p>`,
  },
  {
    id: 'loyalty-bonus',
    name: 'Loyalty Bonus Points',
    channel: 'sms' as const,
    sms_body: '{first_name}, earn DOUBLE POINTS at {restaurant_name} this weekend! Your balance: {points_balance} pts. Reply STOP to opt out.',
    email_subject: 'Double Points Weekend at {restaurant_name}!',
    email_body: `<p>Hi {first_name},</p>
<p>Great news for our {tier} members! This weekend, earn <strong>double points</strong> on every purchase at {restaurant_name}.</p>
<p>Your current balance: <strong>{points_balance} points</strong></p>
<p>Don't miss this chance to level up!</p>`,
  },
  {
    id: 'feedback',
    name: 'Feedback Request',
    channel: 'email' as const,
    sms_body: 'Hi {first_name}, we\'d love your feedback on your recent visit to {restaurant_name}. Quick survey: [LINK]. Reply STOP to opt out.',
    email_subject: 'How was your visit to {restaurant_name}?',
    email_body: `<p>Hi {first_name},</p>
<p>Thank you for dining with us at {restaurant_name}. We hope you had a wonderful experience!</p>
<p>We'd love to hear your thoughts. Your feedback helps us serve you better.</p>
<p><a href="[SURVEY_LINK]">Take our quick 2-minute survey</a></p>
<p>Thank you,<br/>{restaurant_name}</p>`,
  },
  {
    id: 're-engagement',
    name: 'We Miss You',
    channel: 'both' as const,
    sms_body: 'Hey {first_name}, it\'s been a while! We miss you at {restaurant_name}. Come back and enjoy 10% off your next visit! Reply STOP to opt out.',
    email_subject: 'We miss you, {first_name}!',
    email_body: `<p>Hi {first_name},</p>
<p>It's been a while since we've seen you at {restaurant_name}, and we miss you!</p>
<p>As a special welcome back, enjoy <strong>10% off your next visit</strong>.</p>
<p>We hope to see you soon!</p>
<p>Warmly,<br/>{restaurant_name}</p>`,
  },
]

import type { AuthUser } from '@/lib/api/auth'

export const crmFeedbackManageRoles = ['platform_admin', 'owner', 'admin', 'manager', 'marketing'] as const
export const crmFeedbackReadRoles = [...crmFeedbackManageRoles, 'analyst', 'server', 'bartender', 'cashier', 'host'] as const

export type CrmFeedbackSentiment = 'positive' | 'neutral' | 'negative'
export type CrmFeedbackTopic = 'food' | 'service' | 'speed' | 'cleanliness' | 'pricing' | 'reservation' | 'delivery' | 'staff_compliment'

const topicKeywords: Array<[CrmFeedbackTopic, RegExp]> = [
  ['food', /\b(food|meal|dish|burger|pizza|salad|steak|cold|overcooked|undercooked|tasted|flavor)\b/i],
  ['service', /\b(service|server|waiter|waitress|host|rude|friendly|attentive|ignored|staff)\b/i],
  ['speed', /\b(slow|wait|delay|late|fast|quick|minutes|took forever|speed)\b/i],
  ['cleanliness', /\b(clean|dirty|sticky|bathroom|restroom|table|floor|smell)\b/i],
  ['pricing', /\b(price|expensive|cheap|value|bill|charged|overcharged|cost)\b/i],
  ['reservation', /\b(reservation|booking|reserved|host stand|seated)\b/i],
  ['delivery', /\b(delivery|driver|delivered|takeout|pickup|online order)\b/i],
  ['staff_compliment', /\b(great server|excellent service|amazing staff|friendly staff|compliment|shoutout)\b/i],
]

const negativeWords = /\b(bad|awful|terrible|horrible|rude|cold|slow|dirty|wrong|overcharged|refund|complaint|disappointed|never again|one star|1 star|2 star)\b/i
const positiveWords = /\b(great|excellent|amazing|perfect|friendly|delicious|fast|love|loved|best|five star|5 star)\b/i

export function classifyCrmFeedback(input: {
  rating?: number | null
  nps_score?: number | null
  text?: string | null
  provided_sentiment?: CrmFeedbackSentiment
  provided_topics?: CrmFeedbackTopic[]
}): { sentiment: CrmFeedbackSentiment; topics: CrmFeedbackTopic[]; severity: 'low' | 'medium' | 'high' | 'critical' } {
  const text = input.text ?? ''
  const topics = new Set<CrmFeedbackTopic>(input.provided_topics ?? [])
  for (const [topic, pattern] of topicKeywords) {
    if (pattern.test(text)) topics.add(topic)
  }

  let sentiment = input.provided_sentiment
  if (!sentiment) {
    if ((input.rating != null && input.rating <= 3) || (input.nps_score != null && input.nps_score <= 6) || negativeWords.test(text)) {
      sentiment = 'negative'
    } else if ((input.rating != null && input.rating >= 4) || (input.nps_score != null && input.nps_score >= 9) || positiveWords.test(text)) {
      sentiment = 'positive'
    } else {
      sentiment = 'neutral'
    }
  }

  let severity: 'low' | 'medium' | 'high' | 'critical' = 'low'
  if (sentiment === 'negative') severity = 'medium'
  if ((input.rating != null && input.rating <= 2) || (input.nps_score != null && input.nps_score <= 4)) severity = 'high'
  if ((input.rating != null && input.rating <= 1) || /\b(food poisoning|unsafe|allergic|injury|fraud|threat|harass)\b/i.test(text)) severity = 'critical'

  return { sentiment, topics: Array.from(topics), severity }
}

export function crmComplaintSummary(input: { text?: string | null; topics: CrmFeedbackTopic[]; source: string }): string {
  const trimmed = input.text?.trim()
  if (trimmed) return trimmed.length > 180 ? `${trimmed.slice(0, 177)}...` : trimmed
  if (input.topics.length > 0) return `Negative ${input.source} feedback about ${input.topics.join(', ')}`
  return `Negative ${input.source} feedback requires service recovery`
}

export function canCreateCrmFeedback(user: Pick<AuthUser, 'role'>): boolean {
  return crmFeedbackManageRoles.includes(user.role as never)
}

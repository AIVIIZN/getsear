import { z } from 'zod'

export const guestLifecycleStageSchema = z.enum([
  'unknown',
  'prospect',
  'first_time',
  'second_time',
  'emerging_regular',
  'regular',
  'vip',
  'lapsed',
  'at_risk',
  'recovered',
  'dormant',
  'do_not_contact',
])

export const guestProfileStatusSchema = z.enum(['active', 'archived', 'merged'])

export const guestContactTypeSchema = z.enum([
  'email',
  'phone',
  'address',
  'social',
  'reservation',
  'delivery',
  'other',
])

export const guestIdentifierTypeSchema = z.enum([
  'loyalty_id',
  'external_system_id',
  'payment_token_reference',
  'online_ordering_account_id',
  'gift_card_id',
  'reservation_system_id',
  'other',
])

export const guestNoteCategorySchema = z.enum([
  'general',
  'hospitality',
  'service_recovery',
  'preference',
  'allergy',
  'sensitive',
])

export const guestVisibilitySchema = z.enum(['service', 'manager', 'owner'])

export const guestPreferenceCategorySchema = z.enum([
  'menu',
  'seating',
  'service',
  'occasion',
  'channel',
  'accessibility',
  'other',
])

export const guestAllergySeveritySchema = z.enum([
  'unknown',
  'mild',
  'moderate',
  'severe',
  'life_threatening',
])

export const crmTagCategorySchema = z.enum([
  'custom',
  'lifecycle',
  'preference',
  'allergy',
  'marketing',
  'loyalty',
  'risk',
  'system',
])

const optionalUuidSchema = z.string().uuid().optional().nullable()
const metadataSchema = z.record(z.string(), z.unknown()).default({})
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const createGuestSchema = z.object({
  location_id: optionalUuidSchema,
  legacy_customer_id: optionalUuidSchema,
  display_name: z.string().trim().min(1).max(240),
  first_name: z.string().trim().max(120).optional().nullable(),
  last_name: z.string().trim().max(120).optional().nullable(),
  preferred_name: z.string().trim().max(120).optional().nullable(),
  birthday: dateOnlySchema.optional().nullable(),
  anniversary: dateOnlySchema.optional().nullable(),
  lifecycle_stage: guestLifecycleStageSchema.default('unknown'),
  profile_status: guestProfileStatusSchema.default('active'),
  is_vip: z.boolean().default(false),
  metadata: metadataSchema,
})

export const updateGuestSchema = createGuestSchema.partial()

export const createGuestContactPointSchema = z.object({
  location_id: optionalUuidSchema,
  guest_id: z.string().uuid(),
  contact_type: guestContactTypeSchema,
  label: z.string().trim().max(80).optional().nullable(),
  value: z.string().trim().min(1).max(1000),
  normalized_value: z.string().trim().max(1000).optional().nullable(),
  value_hash: z.string().trim().min(32).max(128),
  is_primary: z.boolean().default(false),
  is_verified: z.boolean().default(false),
  verification_source: z.string().trim().max(120).optional().nullable(),
  source: z.string().trim().min(1).max(120).default('manual'),
  metadata: metadataSchema,
})

export const createGuestIdentifierSchema = z.object({
  location_id: optionalUuidSchema,
  guest_id: z.string().uuid(),
  identifier_type: guestIdentifierTypeSchema,
  provider: z.string().trim().max(120).optional().nullable(),
  display_value: z.string().trim().max(240).optional().nullable(),
  value_hash: z.string().trim().min(32).max(128),
  is_primary: z.boolean().default(false),
  metadata: metadataSchema,
})

export const createGuestNoteSchema = z.object({
  location_id: optionalUuidSchema,
  guest_id: z.string().uuid(),
  note_category: guestNoteCategorySchema.default('general'),
  visibility: guestVisibilitySchema.default('service'),
  body: z.string().trim().min(1).max(5000),
  pinned: z.boolean().default(false),
  source: z.string().trim().min(1).max(120).default('manual'),
  metadata: metadataSchema,
})

export const createGuestPreferenceSchema = z.object({
  location_id: optionalUuidSchema,
  guest_id: z.string().uuid(),
  preference_category: guestPreferenceCategorySchema,
  preference_key: z.string().trim().min(1).max(120),
  preference_value: z.record(z.string(), z.unknown()).default({}),
  confidence: z.number().min(0).max(1).default(1),
  source: z.string().trim().min(1).max(120).default('manual'),
  metadata: metadataSchema,
})

export const createGuestAllergySchema = z.object({
  location_id: optionalUuidSchema,
  guest_id: z.string().uuid(),
  allergen: z.string().trim().min(1).max(160),
  severity: guestAllergySeveritySchema.default('unknown'),
  reaction_notes: z.string().trim().max(2000).optional().nullable(),
  source: z.string().trim().min(1).max(120).default('manual'),
  is_active: z.boolean().default(true),
  metadata: metadataSchema,
})

export const createCrmTagSchema = z.object({
  location_id: optionalUuidSchema,
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(140).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(500).optional().nullable(),
  tag_category: crmTagCategorySchema.default('custom'),
  color_token: z.string().trim().max(120).optional().nullable(),
  is_system: z.boolean().default(false),
  is_sensitive: z.boolean().default(false),
  metadata: metadataSchema,
})

export const createGuestTagSchema = z.object({
  location_id: optionalUuidSchema,
  guest_id: z.string().uuid(),
  tag_id: z.string().uuid(),
  assignment_source: z.string().trim().min(1).max(120).default('manual'),
  assignment_reason: z.string().trim().max(500).optional().nullable(),
  confidence: z.number().min(0).max(1).default(1),
  metadata: metadataSchema,
})

export const createGuestTimelineEventSchema = z.object({
  location_id: optionalUuidSchema,
  guest_id: z.string().uuid(),
  event_type: z.string().trim().min(1).max(120),
  event_source: z.string().trim().min(1).max(120).default('crm'),
  event_at: z.string().datetime({ offset: true }).optional(),
  order_id: optionalUuidSchema,
  reservation_id: optionalUuidSchema,
  title: z.string().trim().min(1).max(240),
  body: z.string().trim().max(2000).optional().nullable(),
  visibility: guestVisibilitySchema.default('service'),
  metadata: metadataSchema,
})

export const listGuestsQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  preference: z.string().trim().max(120).optional(),
  tag_id: z.string().uuid().optional(),
  lifecycle_stage: guestLifecycleStageSchema.optional(),
  birthday: dateOnlySchema.optional(),
  location_id: z.string().uuid().optional(),
  last_visit_before: z.string().datetime({ offset: true }).optional(),
  last_visit_after: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sort_by: z.enum(['display_name', 'lifecycle_stage', 'last_visit_at', 'total_visits', 'total_spend', 'created_at']).default('display_name'),
  sort_dir: z.enum(['asc', 'desc']).default('asc'),
})

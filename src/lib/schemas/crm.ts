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

export const guestConsentChannelSchema = z.enum(['email', 'sms', 'push', 'in_app', 'phone', 'mail'])
export const guestConsentPurposeSchema = z.enum(['marketing', 'transactional', 'loyalty', 'reservation', 'feedback', 'personalization'])
export const guestConsentStatusSchema = z.enum(['granted', 'revoked', 'unknown'])
export const suppressionReasonSchema = z.enum(['revoked_consent', 'unsubscribe', 'bounce', 'complaint', 'privacy_request', 'manual', 'legal_hold'])
export const privacyRequestTypeSchema = z.enum(['export', 'delete', 'correct', 'do_not_contact', 'opt_out_sale_sharing', 'limit_sensitive_use'])
export const privacyRequestStatusSchema = z.enum(['submitted', 'needs_verification', 'approved', 'in_progress', 'completed', 'rejected', 'cancelled'])
export const crmImportSourceTypeSchema = z.enum(['csv', 'pos_customers', 'mailchimp', 'constant_contact', 'toast', 'square', 'opentable', 'reservation_system', 'loyalty', 'gift_cards', 'spreadsheet'])
export const crmImportJobStatusSchema = z.enum(['draft', 'validated', 'importing', 'completed', 'completed_with_errors', 'failed', 'rolled_back'])
export const crmImportRowStatusSchema = z.enum(['valid', 'invalid', 'duplicate', 'imported', 'skipped', 'rolled_back'])

const optionalUuidSchema = z.string().uuid().optional().nullable()
const metadataSchema = z.record(z.string(), z.unknown()).default({})
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const guestMergeConfidenceLevelSchema = z.enum(['100', '90', '75', '50', 'below_50'])
export const guestMergeCandidateStatusSchema = z.enum(['pending', 'merged', 'dismissed', 'kept_separate', 'household'])
export const guestMergeDecisionTypeSchema = z.enum(['merge', 'dismiss', 'keep_separate', 'mark_household'])
export const guestRelationshipTypeSchema = z.enum(['household', 'spouse', 'partner', 'parent', 'child', 'sibling', 'caregiver', 'friend', 'other'])

export const listGuestMergeCandidatesQuerySchema = z.object({
  guest_id: z.string().uuid().optional(),
  status: guestMergeCandidateStatusSchema.default('pending'),
  generate: z.coerce.boolean().default(true),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export const mergeGuestCandidateSchema = z.object({
  candidate_id: z.string().uuid().optional(),
  primary_guest_id: z.string().uuid(),
  secondary_guest_id: z.string().uuid(),
  reason: z.string().trim().max(500).optional().nullable(),
})

export const resolveGuestCandidateSchema = z.object({
  candidate_id: z.string().uuid(),
  decision_type: z.enum(['dismiss', 'keep_separate']),
  reason: z.string().trim().max(500).optional().nullable(),
})

export const markGuestHouseholdSchema = z.object({
  candidate_id: z.string().uuid().optional(),
  primary_guest_id: z.string().uuid(),
  secondary_guest_id: z.string().uuid(),
  household_name: z.string().trim().min(1).max(160).optional(),
  relationship_type: guestRelationshipTypeSchema.default('household'),
  reason: z.string().trim().max(500).optional().nullable(),
})

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

export const upsertGuestConsentSchema = z.object({
  contact_point_id: optionalUuidSchema,
  channel: guestConsentChannelSchema,
  purpose: guestConsentPurposeSchema,
  status: guestConsentStatusSchema,
  source: z.string().trim().min(1).max(120).default('manual'),
  proof: metadataSchema,
  policy_version_id: optionalUuidSchema,
  metadata: metadataSchema,
})

export const createPrivacyRequestSchema = z.object({
  request_type: privacyRequestTypeSchema,
  requested_by_name: z.string().trim().min(1).max(240),
  requested_by_contact: z.string().trim().min(1).max(320),
  details: z.string().trim().max(2000).optional().nullable(),
  priority: z.enum(['normal', 'urgent']).default('normal'),
  due_at: z.string().datetime({ offset: true }).optional().nullable(),
  metadata: metadataSchema,
})

export const updatePrivacyRequestSchema = z.object({
  request_id: z.string().uuid(),
  action: z.enum(['approve', 'start', 'complete_export', 'complete_delete', 'complete_suppression', 'reject', 'cancel']),
  note: z.string().trim().max(1000).optional().nullable(),
  metadata: metadataSchema,
})

export const crmImportFieldMappingSchema = z.object({
  display_name: z.string().trim().min(1).default('display_name'),
  first_name: z.string().trim().optional().nullable(),
  last_name: z.string().trim().optional().nullable(),
  email: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  birthday: z.string().trim().optional().nullable(),
  consent_status: z.string().trim().optional().nullable(),
  consent_source: z.string().trim().optional().nullable(),
})

export const crmImportMergeRulesSchema = z.object({
  duplicate_strategy: z.enum(['skip', 'merge_safe_fields']).default('skip'),
  require_consent_for_marketing: z.boolean().default(true),
  rollback_safe: z.boolean().default(true),
})

export const createCrmImportJobSchema = z.object({
  source_type: crmImportSourceTypeSchema,
  location_id: optionalUuidSchema,
  file_name: z.string().trim().min(1).max(240),
  mapping: crmImportFieldMappingSchema,
  merge_rules: crmImportMergeRulesSchema.default({
    duplicate_strategy: 'skip',
    require_consent_for_marketing: true,
    rollback_safe: true,
  }),
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(500),
  commit: z.boolean().default(false),
})

export const listCrmImportJobsQuerySchema = z.object({
  status: crmImportJobStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
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

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
export const crmLoyaltyProgramTypeSchema = z.enum(['points', 'visits', 'item_category', 'tiered', 'vip_club', 'paid_membership', 'birthday_anniversary', 'surprise_delight', 'punch_card', 'referral'])
export const crmLoyaltyProgramStatusSchema = z.enum(['draft', 'active', 'paused', 'archived'])
export const crmLoyaltyRuleTypeSchema = z.enum(['points_per_dollar', 'points_per_visit', 'item_reward', 'category_reward', 'tier_multiplier', 'vip_club', 'paid_membership', 'birthday', 'anniversary', 'surprise_delight', 'punch_card', 'referral'])
export const crmRewardTypeSchema = z.enum(['discount_amount', 'discount_percent', 'free_item', 'free_category_item', 'experience', 'surprise_delight'])
export const crmRewardStatusSchema = z.enum(['draft', 'active', 'paused', 'archived'])
export const crmRewardRedemptionStatusSchema = z.enum(['reserved', 'applied', 'voided', 'expired'])
export const crmLoyaltyReviewStatusSchema = z.enum(['open', 'in_review', 'resolved', 'dismissed'])
export const crmSegmentTypeSchema = z.enum(['dynamic', 'static'])
export const crmSegmentStatusSchema = z.enum(['draft', 'active', 'archived'])
export const crmSegmentMatchModeSchema = z.enum(['all', 'any'])
export const crmSegmentFieldSchema = z.enum([
  'lifecycle_stage',
  'total_spend',
  'total_visits',
  'average_check',
  'days_since_last_visit',
  'birthday_month',
  'location_id',
  'is_vip',
  'tag_slug',
  'tag_category',
  'email_marketing_consent',
  'sms_marketing_consent',
  'loyalty_points_balance',
  'loyalty_tier',
  'favorite_item_contains',
  'order_channel',
])
export const crmSegmentOperatorSchema = z.enum([
  'equals',
  'not_equals',
  'contains',
  'greater_than',
  'less_than',
  'between',
  'exists',
  'not_exists',
  'days_since',
  'count_at_least',
])
export const crmFeedbackSourceTypeSchema = z.enum([
  'receipt_qr',
  'email',
  'sms',
  'reservation_follow_up',
  'online_order_follow_up',
  'manual',
  'review_import',
])
export const crmFeedbackSentimentSchema = z.enum(['positive', 'neutral', 'negative'])
export const crmFeedbackTopicSchema = z.enum([
  'food',
  'service',
  'speed',
  'cleanliness',
  'pricing',
  'reservation',
  'delivery',
  'staff_compliment',
])
export const crmSurveyStatusSchema = z.enum(['draft', 'active', 'paused', 'archived'])
export const crmSurveyTriggerEventSchema = z.enum([
  'post_visit',
  'receipt',
  'reservation_complete',
  'online_order_complete',
  'manager_manual',
  'review_import',
])
export const crmCampaignTypeSchema = z.enum(['email', 'sms', 'push', 'guest_portal', 'receipt', 'qr', 'reservation_follow_up', 'review_request', 'win_back', 'birthday', 'anniversary', 'event_invite', 'menu_announcement', 'vip_invite', 'recovery'])
export const crmCampaignStatusSchema = z.enum(['draft', 'ready', 'scheduled', 'sending', 'sent', 'paused', 'archived'])
export const crmCampaignChannelSchema = z.enum(['email', 'sms', 'push', 'guest_portal', 'receipt', 'qr'])
export const crmCampaignToneSchema = z.enum(['warm', 'polished', 'playful', 'urgent', 'grateful', 'concise'])

const optionalUuidSchema = z.string().uuid().optional().nullable()
const metadataSchema = z.record(z.string(), z.unknown()).default({})
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const createCrmSurveySchema = z.object({
  location_id: optionalUuidSchema,
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(1000).optional().nullable(),
  status: crmSurveyStatusSchema.default('active'),
  source_type: crmFeedbackSourceTypeSchema.default('receipt_qr'),
  trigger_event: crmSurveyTriggerEventSchema.default('post_visit'),
  questions: z.array(z.object({
    key: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(240),
    type: z.enum(['rating', 'nps', 'text', 'single_choice', 'multi_choice']),
    required: z.boolean().default(false),
    options: z.array(z.string().trim().min(1).max(120)).max(12).optional(),
  })).max(24).default([]),
  metadata: metadataSchema,
})

export const createCrmSurveyResponseSchema = z.object({
  location_id: optionalUuidSchema,
  survey_id: optionalUuidSchema,
  guest_id: optionalUuidSchema,
  order_id: optionalUuidSchema,
  staff_user_id: optionalUuidSchema,
  source_type: crmFeedbackSourceTypeSchema,
  rating: z.number().int().min(1).max(5).optional().nullable(),
  nps_score: z.number().int().min(0).max(10).optional().nullable(),
  sentiment: crmFeedbackSentimentSchema.optional(),
  topics: z.array(crmFeedbackTopicSchema).max(8).default([]),
  response_text: z.string().trim().max(4000).optional().nullable(),
  contact_requested: z.boolean().default(false),
  metadata: metadataSchema,
})

export const listCrmFeedbackQuerySchema = z.object({
  sentiment: crmFeedbackSentimentSchema.optional(),
  guest_id: z.string().uuid().optional(),
  order_id: z.string().uuid().optional(),
  source_type: crmFeedbackSourceTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

export const createCrmReviewSchema = z.object({
  location_id: optionalUuidSchema,
  guest_id: optionalUuidSchema,
  order_id: optionalUuidSchema,
  provider: z.string().trim().min(1).max(80),
  external_review_id: z.string().trim().max(180).optional().nullable(),
  reviewer_display_name: z.string().trim().max(180).optional().nullable(),
  rating: z.number().min(0).max(5).optional().nullable(),
  title: z.string().trim().max(240).optional().nullable(),
  body: z.string().trim().max(6000).optional().nullable(),
  review_url: z.string().url().max(2000).optional().nullable(),
  published_at: z.string().datetime().optional().nullable(),
  sentiment: crmFeedbackSentimentSchema.optional(),
  topics: z.array(crmFeedbackTopicSchema).max(8).default([]),
  metadata: metadataSchema,
})

export const listCrmReviewsQuerySchema = z.object({
  provider: z.string().trim().max(80).optional(),
  sentiment: crmFeedbackSentimentSchema.optional(),
  guest_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

export const crmSegmentRuleSchema = z.object({
  field: crmSegmentFieldSchema,
  operator: crmSegmentOperatorSchema,
  value: z.union([
    z.string().trim().max(240),
    z.number(),
    z.boolean(),
    z.array(z.union([z.string().trim().max(240), z.number()])).max(2),
  ]).optional(),
})

export type CrmSegmentRuleInput = z.infer<typeof crmSegmentRuleSchema>
export type CrmSegmentRuleGroupInput = {
  match: 'all' | 'any'
  rules: Array<CrmSegmentRuleInput | CrmSegmentRuleGroupInput>
}

export const crmSegmentRuleGroupSchema: z.ZodType<CrmSegmentRuleGroupInput> = z.lazy(() => z.object({
  match: crmSegmentMatchModeSchema.default('all'),
  rules: z.array(z.union([crmSegmentRuleSchema, crmSegmentRuleGroupSchema])).min(1).max(24),
}))

export const createCrmSegmentSchema = z.object({
  location_id: optionalUuidSchema,
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional().nullable(),
  segment_type: crmSegmentTypeSchema.default('dynamic'),
  status: crmSegmentStatusSchema.default('draft'),
  match_mode: crmSegmentMatchModeSchema.default('all'),
  rule_tree: crmSegmentRuleGroupSchema,
  metadata: metadataSchema,
})

export const updateCrmSegmentSchema = createCrmSegmentSchema.partial().extend({
  rule_tree: crmSegmentRuleGroupSchema.optional(),
})

export const previewCrmSegmentSchema = z.object({
  rule_tree: crmSegmentRuleGroupSchema,
  sample_limit: z.number().int().min(1).max(25).default(8),
})

export const buildCrmSegmentDraftSchema = z.object({
  prompt: z.string().trim().min(8).max(1000),
  sample_limit: z.number().int().min(1).max(12).default(5),
})

export const listCrmSegmentsQuerySchema = z.object({
  status: crmSegmentStatusSchema.optional(),
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

export const createCrmCampaignSchema = z.object({
  location_id: optionalUuidSchema,
  segment_id: z.string().uuid(),
  name: z.string().trim().min(1).max(180),
  campaign_type: crmCampaignTypeSchema,
  status: crmCampaignStatusSchema.default('draft'),
  goal: z.string().trim().min(1).max(500),
  offer: z.string().trim().max(500).optional().nullable(),
  tone: crmCampaignToneSchema.default('warm'),
  brand_voice: z.string().trim().min(1).max(120).default('hospitality'),
  primary_channel: crmCampaignChannelSchema,
  secondary_channels: z.array(crmCampaignChannelSchema).max(5).default([]),
  subject: z.string().trim().max(180).optional().nullable(),
  preheader: z.string().trim().max(220).optional().nullable(),
  message_body: z.string().trim().min(1).max(5000),
  sms_body: z.string().trim().max(320).optional().nullable(),
  mobile_body: z.string().trim().max(500).optional().nullable(),
  receipt_body: z.string().trim().max(700).optional().nullable(),
  scheduled_for: z.string().datetime({ offset: true }).optional().nullable(),
  metadata: metadataSchema,
})

export const previewCrmCampaignSchema = createCrmCampaignSchema.pick({
  campaign_type: true,
  goal: true,
  offer: true,
  tone: true,
  brand_voice: true,
  primary_channel: true,
  secondary_channels: true,
  subject: true,
  preheader: true,
  message_body: true,
  sms_body: true,
  mobile_body: true,
  receipt_body: true,
}).extend({
  segment_id: z.string().uuid().optional(),
})

export const listCrmCampaignsQuerySchema = z.object({
  status: crmCampaignStatusSchema.optional(),
  segment_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

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

export const createCrmLoyaltyRuleSchema = z.object({
  location_id: optionalUuidSchema,
  rule_type: crmLoyaltyRuleTypeSchema,
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(1000).optional().nullable(),
  points: z.number().int().min(0).default(0),
  multiplier: z.number().min(0).default(1),
  minimum_spend_cents: z.number().int().min(0).default(0),
  menu_item_id: optionalUuidSchema,
  menu_category_id: optionalUuidSchema,
  starts_at: z.string().datetime({ offset: true }).optional().nullable(),
  ends_at: z.string().datetime({ offset: true }).optional().nullable(),
  is_active: z.boolean().default(true),
  metadata: metadataSchema,
})

export const createCrmLoyaltyTierSchema = z.object({
  name: z.string().trim().min(1).max(120),
  rank: z.number().int().min(0).default(0),
  threshold_points: z.number().int().min(0).default(0),
  threshold_spend_cents: z.number().int().min(0).default(0),
  points_multiplier: z.number().min(0).default(1),
  benefits: z.array(z.object({
    benefit_type: z.enum(['points_multiplier', 'exclusive_reward', 'vip_service', 'paid_membership', 'birthday', 'anniversary', 'surprise_delight']),
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(1000).optional().nullable(),
    metadata: metadataSchema,
  })).default([]),
  metadata: metadataSchema,
})

export const createCrmLoyaltyProgramSchema = z.object({
  location_id: optionalUuidSchema,
  name: z.string().trim().min(1).max(200),
  program_type: crmLoyaltyProgramTypeSchema.default('points'),
  status: crmLoyaltyProgramStatusSchema.default('active'),
  points_per_dollar: z.number().min(0).default(1),
  points_per_visit: z.number().int().min(0).default(0),
  membership_fee_cents: z.number().int().min(0).default(0),
  birthday_points: z.number().int().min(0).default(0),
  anniversary_points: z.number().int().min(0).default(0),
  referral_points: z.number().int().min(0).default(0),
  surprise_enabled: z.boolean().default(false),
  starts_at: z.string().datetime({ offset: true }).optional().nullable(),
  ends_at: z.string().datetime({ offset: true }).optional().nullable(),
  rules: z.array(createCrmLoyaltyRuleSchema).default([]),
  tiers: z.array(createCrmLoyaltyTierSchema).default([]),
  settings: metadataSchema,
  metadata: metadataSchema,
})

export const listCrmLoyaltyProgramsQuerySchema = z.object({
  status: crmLoyaltyProgramStatusSchema.optional(),
  location_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

export const createCrmLoyaltyAccountSchema = z.object({
  program_id: z.string().uuid(),
  guest_id: z.string().uuid(),
  location_id: optionalUuidSchema,
  legacy_customer_id: optionalUuidSchema,
  metadata: metadataSchema,
})

export const listCrmLoyaltyAccountsQuerySchema = z.object({
  program_id: z.string().uuid().optional(),
  guest_id: z.string().uuid().optional(),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

export const createCrmRewardSchema = z.object({
  program_id: z.string().uuid(),
  tier_id: optionalUuidSchema,
  location_id: optionalUuidSchema,
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(1000).optional().nullable(),
  reward_type: crmRewardTypeSchema.default('discount_amount'),
  points_cost: z.number().int().min(0).default(0),
  value_cents: z.number().int().min(0).default(0),
  percent_off: z.number().min(0.01).max(100).optional().nullable(),
  menu_item_id: optionalUuidSchema,
  menu_category_id: optionalUuidSchema,
  status: crmRewardStatusSchema.default('active'),
  starts_at: z.string().datetime({ offset: true }).optional().nullable(),
  ends_at: z.string().datetime({ offset: true }).optional().nullable(),
  per_guest_limit: z.number().int().min(1).optional().nullable(),
  requires_manager_override: z.boolean().default(false),
  metadata: metadataSchema,
})

export const listCrmRewardsQuerySchema = z.object({
  program_id: z.string().uuid().optional(),
  status: crmRewardStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

export const earnCrmLoyaltyPointsSchema = z.object({
  order_id: z.string().uuid().optional().nullable(),
  points: z.number().int().min(1).optional(),
  amount_cents: z.number().int().min(0).optional(),
  visits: z.number().int().min(0).default(0),
  event_type: z.enum(['earn', 'surprise_delight', 'referral', 'punch']).default('earn'),
  explanation: z.string().trim().min(1).max(500).default('POS loyalty earn'),
  metadata: metadataSchema,
})

export const redeemCrmRewardSchema = z.object({
  reward_id: z.string().uuid(),
  order_id: z.string().uuid().optional().nullable(),
  status: crmRewardRedemptionStatusSchema.default('reserved'),
  manager_pin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must be digits only').optional(),
  explanation: z.string().trim().min(1).max(500).default('Reward redeemed at checkout'),
  metadata: metadataSchema,
})

export const listCrmLoyaltyDashboardQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
})

export const listCrmLoyaltyFraudQuerySchema = z.object({
  status: crmLoyaltyReviewStatusSchema.optional(),
  generate: z.coerce.boolean().default(true),
  days: z.coerce.number().int().min(1).max(90).default(30),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

export const updateCrmLoyaltyReviewItemSchema = z.object({
  review_item_id: z.string().uuid(),
  status: crmLoyaltyReviewStatusSchema,
  resolution_note: z.string().trim().max(1000).optional().nullable(),
})

export const crmCheckoutLoyaltyQuerySchema = z.object({
  guest_id: z.string().uuid().optional(),
  order_id: z.string().uuid().optional(),
})

export const crmCheckoutLoyaltyActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('enroll'),
    guest_id: z.string().uuid(),
    order_id: z.string().uuid().optional().nullable(),
    program_id: z.string().uuid().optional().nullable(),
  }),
  z.object({
    action: z.literal('redeem'),
    account_id: z.string().uuid(),
    reward_id: z.string().uuid(),
    order_id: z.string().uuid(),
    manager_pin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must be digits only').optional(),
  }),
])

export const listCrmLedgerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
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

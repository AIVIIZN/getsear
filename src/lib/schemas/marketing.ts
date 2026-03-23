import { z } from 'zod'

/** POST /api/marketing/campaigns */
export const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['email', 'sms', 'both']),
  subject: z.string().max(200).optional(),
  content: z.string().max(10000),
  template_id: z.string().uuid().optional(),
  segment_id: z.string().uuid().optional(),
  scheduled_for: z.string().datetime({ offset: true }).optional(),
  location_id: z.string().uuid().optional(),
})

/** PATCH /api/marketing/campaigns/[id] */
export const updateCampaignSchema = createCampaignSchema.partial()

/** POST /api/marketing/campaigns/[id]/send */
export const sendCampaignSchema = z.object({
  test_mode: z.boolean().default(false),
  test_recipient: z.string().optional(),
})

/** POST /api/marketing/campaigns/[id]/recipients */
export const updateRecipientsSchema = z.object({
  segment_id: z.string().uuid().optional(),
  customer_ids: z.array(z.string().uuid()).optional(),
  tags: z.array(z.string()).optional(),
})

/** GET /api/marketing/campaigns/[id]/preview query */
export const previewQuerySchema = z.object({
  format: z.enum(['html', 'text']).default('html'),
})

/** POST /api/marketing/segments */
export const createSegmentSchema = z.object({
  name: z.string().min(1).max(200),
  rules: z.array(z.object({
    field: z.string(),
    operator: z.enum(['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'contains', 'not_contains', 'in', 'not_in']),
    value: z.unknown(),
  })).min(1),
  logic: z.enum(['and', 'or']).default('and'),
})

/** POST /api/marketing/templates */
export const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['email', 'sms']),
  subject: z.string().max(200).optional(),
  content: z.string().max(10000),
  variables: z.array(z.string()).default([]),
})

/** GET /api/marketing/campaigns query */
export const listCampaignsQuerySchema = z.object({
  status: z.enum(['draft', 'scheduled', 'sending', 'sent', 'cancelled']).optional(),
  type: z.enum(['email', 'sms', 'both']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

/** GET /api/marketing/analytics query */
export const analyticsQuerySchema = z.object({
  campaign_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
})

/** GET /api/marketing/segments/count query */
export const segmentCountQuerySchema = z.object({
  segment_id: z.string().uuid(),
})

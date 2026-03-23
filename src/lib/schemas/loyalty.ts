import { z } from 'zod'

/** POST /api/loyalty/programs */
export const createProgramSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['points', 'visits', 'spend']),
  earn_rate: z.number().min(0).default(1),
  earn_unit: z.string().max(50).default('point'),
  redemption_threshold: z.number().int().min(1).default(100),
  reward_value_cents: z.number().int().min(1).default(500),
  reward_description: z.string().max(500).optional(),
  is_active: z.boolean().default(true),
  tiers: z.array(z.object({
    name: z.string().min(1).max(100),
    threshold: z.number().int().min(0),
    multiplier: z.number().min(1).default(1),
    perks: z.array(z.string()).default([]),
  })).optional().default([]),
})

/** PATCH /api/loyalty/programs/[id] */
export const updateProgramSchema = createProgramSchema.partial()

/** POST /api/loyalty/enroll */
export const enrollSchema = z.object({
  customer_id: z.string().uuid(),
  program_id: z.string().uuid(),
})

/** POST /api/loyalty/accounts/[id]/earn */
export const earnSchema = z.object({
  order_id: z.string().uuid().optional(),
  amount_cents: z.number().int().min(0).optional(),
  points: z.number().int().min(0).optional(),
  reason: z.string().max(200).optional(),
})

/** POST /api/loyalty/accounts/[id]/redeem */
export const redeemSchema = z.object({
  points: z.number().int().min(1),
  order_id: z.string().uuid().optional(),
  reward_id: z.string().uuid().optional(),
})

/** POST /api/loyalty/accounts/[id]/adjust */
export const adjustSchema = z.object({
  points: z.number().int(),
  reason: z.string().min(1).max(500),
})

/** GET /api/loyalty/accounts query */
export const listAccountsQuerySchema = z.object({
  program_id: z.string().uuid().optional(),
  customer_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

/** GET /api/loyalty/accounts/[id]/transactions query */
export const transactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

/** GET /api/loyalty/lookup query */
export const lookupQuerySchema = z.object({
  phone: z.string().optional(),
  email: z.string().optional(),
  card_number: z.string().optional(),
})

/** GET /api/loyalty/dashboard query */
export const dashboardQuerySchema = z.object({
  program_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
})

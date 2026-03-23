import { z } from 'zod'

/** POST /api/house-accounts */
export const createHouseAccountSchema = z.object({
  company_name: z.string().min(1).max(200),
  contact_name: z.string().max(200).optional(),
  contact_email: z.string().email().optional(),
  contact_phone: z.string().max(20).optional(),
  credit_limit_cents: z.number().int().min(0).default(0),
  billing_address: z.string().max(500).optional(),
  payment_terms_days: z.number().int().min(0).default(30),
  notes: z.string().max(2000).optional(),
  location_id: z.string().uuid().optional(),
  tax_exempt: z.boolean().default(false),
  tax_exempt_id: z.string().max(50).optional(),
})

/** PATCH /api/house-accounts/[id] */
export const updateHouseAccountSchema = createHouseAccountSchema.partial().extend({
  is_active: z.boolean().optional(),
})

/** POST /api/house-accounts/[id]/charge */
export const chargeHouseAccountSchema = z.object({
  order_id: z.string().uuid(),
  amount_cents: z.number().int().min(1),
  notes: z.string().max(500).optional(),
})

/** POST /api/house-accounts/[id]/payment */
export const recordPaymentSchema = z.object({
  amount_cents: z.number().int().min(1),
  payment_method: z.enum(['check', 'wire', 'ach', 'card', 'cash', 'other']),
  reference: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
})

/** GET /api/house-accounts/[id]/bill query */
export const billQuerySchema = z.object({
  date_from: z.string().optional(),
  date_to: z.string().optional(),
})

/** GET /api/house-accounts/[id]/statement query */
export const statementQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2100),
})

/** GET /api/house-accounts query */
export const listHouseAccountsQuerySchema = z.object({
  search: z.string().optional(),
  is_active: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

/** GET /api/house-accounts/aging query */
export const agingQuerySchema = z.object({
  location_id: z.string().uuid().optional(),
})

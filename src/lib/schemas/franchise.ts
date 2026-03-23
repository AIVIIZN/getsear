import { z } from 'zod'

/** GET /api/franchise/locations query */
export const franchiseLocationsQuerySchema = z.object({
  status: z.enum(['active', 'inactive', 'pending']).optional(),
})

/** POST /api/franchise/locations/sync */
export const syncLocationsSchema = z.object({
  location_ids: z.array(z.string().uuid()).optional(),
  sync_menu: z.boolean().default(true),
  sync_settings: z.boolean().default(false),
})

/** POST /api/franchise/menu-push */
export const menuPushSchema = z.object({
  source_location_id: z.string().uuid(),
  target_location_ids: z.array(z.string().uuid()).min(1),
  include_prices: z.boolean().default(true),
  include_modifiers: z.boolean().default(true),
})

/** POST /api/franchise/royalties/calculate */
export const calculateRoyaltiesSchema = z.object({
  location_id: z.string().uuid(),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

/** POST /api/franchise/royalties/invoice */
export const createRoyaltyInvoiceSchema = z.object({
  royalty_id: z.string().uuid(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(2000).optional(),
})

/** GET /api/franchise/royalties query */
export const listRoyaltiesQuerySchema = z.object({
  location_id: z.string().uuid().optional(),
  status: z.enum(['pending', 'invoiced', 'paid', 'overdue']).optional(),
  period_start: z.string().optional(),
  period_end: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

/** PATCH /api/franchise/royalties/[id] */
export const updateRoyaltySchema = z.object({
  status: z.enum(['pending', 'invoiced', 'paid', 'overdue']).optional(),
  paid_at: z.string().datetime({ offset: true }).optional(),
  payment_reference: z.string().max(200).optional(),
})

/** GET /api/franchise/reports query */
export const franchiseReportsQuerySchema = z.object({
  report_type: z.enum(['sales', 'royalties', 'comparison']).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  location_ids: z.string().optional(), // comma-separated
})

/** GET /api/franchise/consolidated-pl query */
export const consolidatedPlQuerySchema = z.object({
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  location_ids: z.string().optional(), // comma-separated
})

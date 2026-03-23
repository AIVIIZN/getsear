import { z } from 'zod'

/** POST /api/customers */
export const createCustomerSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().max(100).default(''),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  tags: z.array(z.string()).default([]),
  is_vip: z.boolean().default(false),
  birthday: z.string().optional().nullable(),
  allergies: z.array(z.string()).default([]),
  dietary_preferences: z.array(z.string()).default([]),
})

/** PATCH /api/customers/[id] */
export const updateCustomerSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().max(100).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  tags: z.array(z.string()).optional(),
  is_vip: z.boolean().optional(),
  birthday: z.string().optional().nullable(),
  allergies: z.array(z.string()).optional(),
  dietary_preferences: z.array(z.string()).optional(),
})

/** GET /api/customers query params */
export const listCustomersQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sort_by: z.enum(['first_name', 'last_name', 'total_visits', 'total_spend', 'last_visit_at', 'created_at']).default('last_name'),
  sort_dir: z.enum(['asc', 'desc']).default('asc'),
  is_vip: z.coerce.boolean().optional(),
})

/** GET /api/customers/lookup query params */
export const lookupCustomerQuerySchema = z.object({
  phone: z.string().optional(),
  email: z.string().optional(),
})

/** POST /api/customers/merge */
export const mergeCustomersSchema = z.object({
  primary_id: z.string().uuid(),
  secondary_id: z.string().uuid(),
})

/** GET /api/customers/[id]/orders query */
export const customerOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

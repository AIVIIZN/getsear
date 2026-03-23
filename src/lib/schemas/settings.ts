import { z } from 'zod'

/** PATCH /api/settings/organization */
export const updateOrgSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  owner_phone: z.string().max(20).optional(),
  owner_email: z.string().email().optional(),
  owner_name: z.string().max(200).optional(),
  primary_color: z.string().max(7).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
})

/** POST /api/settings/locations */
export const createLocationSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  zip: z.string().max(20).optional(),
  country: z.string().max(2).default('US'),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  timezone: z.string().max(50).default('America/New_York'),
  is_active: z.boolean().default(true),
  settings: z.record(z.string(), z.unknown()).optional(),
})

/** PATCH /api/settings/locations/[id] */
export const updateLocationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  zip: z.string().max(20).optional(),
  country: z.string().max(2).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  timezone: z.string().max(50).optional(),
  is_active: z.boolean().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
})

/** POST /api/settings/tax-rates */
export const createTaxRateSchema = z.object({
  name: z.string().min(1).max(100),
  rate: z.number().min(0).max(100),
  is_inclusive: z.boolean().default(false),
  applies_to: z.enum(['all', 'food', 'alcohol', 'retail']).default('all'),
  location_id: z.string().uuid().optional(),
  is_active: z.boolean().default(true),
})

/** PATCH /api/settings/tax-rates/[id] */
export const updateTaxRateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  rate: z.number().min(0).max(100).optional(),
  is_inclusive: z.boolean().optional(),
  applies_to: z.enum(['all', 'food', 'alcohol', 'retail']).optional(),
  is_active: z.boolean().optional(),
})

/** POST /api/settings/terminals */
export const createTerminalSchema = z.object({
  name: z.string().min(1).max(100),
  location_id: z.string().uuid(),
  terminal_type: z.enum(['pos', 'kds', 'kiosk', 'register']).default('pos'),
  hardware_id: z.string().max(200).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
})

/** PATCH /api/settings/terminals/[id] */
export const updateTerminalSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  location_id: z.string().uuid().optional(),
  terminal_type: z.enum(['pos', 'kds', 'kiosk', 'register']).optional(),
  hardware_id: z.string().max(200).optional(),
  is_active: z.boolean().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
})

/** PATCH /api/settings/roles/[id] */
export const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  permissions: z.record(z.string(), z.boolean()).optional(),
  is_active: z.boolean().optional(),
})

/** POST /api/settings/modules */
export const updateModulesSchema = z.object({
  modules: z.record(z.string(), z.boolean()),
})

/** GET /api/settings/locations query */
export const listLocationsQuerySchema = z.object({
  is_active: z.coerce.boolean().optional(),
})

/** GET /api/settings/tax-rates query */
export const listTaxRatesQuerySchema = z.object({
  location_id: z.string().uuid().optional(),
  is_active: z.coerce.boolean().optional(),
})

/** GET /api/settings/terminals query */
export const listTerminalsQuerySchema = z.object({
  location_id: z.string().uuid().optional(),
  is_active: z.coerce.boolean().optional(),
})

/** Print jobs */
export const reprintSchema = z.object({
  print_job_id: z.string().uuid(),
})

export const listPrintJobsQuerySchema = z.object({
  location_id: z.string().uuid().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

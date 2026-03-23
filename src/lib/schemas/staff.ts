import { z } from 'zod'

const staffRoles = [
  'platform_admin', 'owner', 'admin', 'manager', 'server',
  'bartender', 'host', 'kitchen', 'cashier', 'driver', 'kiosk', 'readonly',
] as const

/** POST /api/staff */
export const createStaffSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  display_name: z.string().max(200).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  role: z.enum(staffRoles),
  hourly_rate: z.string().optional().nullable(),
  pin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must be digits only').optional(),
  location_ids: z.array(z.string().uuid()).optional(),
  hire_date: z.string().optional().nullable(),
})

/** PATCH /api/staff/[id] */
export const updateStaffSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  display_name: z.string().max(200).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  role: z.enum(staffRoles).optional(),
  hourly_rate: z.string().optional().nullable(),
  pin: z.string().min(4).max(6).regex(/^\d+$/).optional(),
  location_ids: z.array(z.string().uuid()).optional(),
  hire_date: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
})

/** GET /api/staff query params */
export const listStaffQuerySchema = z.object({
  role: z.enum(staffRoles).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  location_id: z.string().uuid().optional(),
})

/** POST /api/staff/[id]/clock-in */
export const clockInSchema = z.object({
  location_id: z.string().uuid(),
  position: z.string().max(50).optional(),
  pin: z.string().min(4).max(6).regex(/^\d+$/).optional(),
})

/** POST /api/staff/[id]/clock-out */
export const clockOutSchema = z.object({
  pin: z.string().min(4).max(6).regex(/^\d+$/).optional(),
  tip_declared: z.string().optional(),
})

/** POST /api/staff/[id]/break-start */
export const breakStartSchema = z.object({
  break_type: z.enum(['paid', 'unpaid']).default('unpaid'),
})

/** POST /api/staff/[id]/break-end */
export const breakEndSchema = z.object({
  notes: z.string().max(200).optional(),
})

/** GET /api/staff/[id]/time-entries query */
export const timeEntriesQuerySchema = z.object({
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

/** PATCH /api/staff/time-entries/[id] */
export const updateTimeEntrySchema = z.object({
  clock_in: z.string().datetime({ offset: true }).optional(),
  clock_out: z.string().datetime({ offset: true }).optional(),
  notes: z.string().max(500).optional(),
})

/** POST /api/staff/time-entries/[id]/approve */
export const approveTimeEntrySchema = z.object({
  approved: z.boolean(),
  notes: z.string().max(500).optional(),
})

/** POST /api/staff/tips */
export const recordTipsSchema = z.object({
  user_id: z.string().uuid(),
  amount: z.string().regex(/^\d+\.\d{2}$/),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.enum(['cash', 'card', 'declared']).default('declared'),
  location_id: z.string().uuid(),
})

/** POST /api/staff/tips/distribute */
export const distributeTipsSchema = z.object({
  location_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pool_type: z.enum(['equal', 'hours_worked', 'points', 'custom']),
  tip_amount: z.string().regex(/^\d+\.\d{2}$/),
  participant_ids: z.array(z.string().uuid()),
  custom_splits: z.array(z.object({
    user_id: z.string().uuid(),
    amount: z.string().regex(/^\d+\.\d{2}$/),
  })).optional(),
})

/** POST /api/staff/tip-pool-config */
export const tipPoolConfigSchema = z.object({
  location_id: z.string().uuid(),
  pool_type: z.enum(['equal', 'hours_worked', 'points', 'custom']),
  eligible_roles: z.array(z.enum(staffRoles)),
  is_active: z.boolean().default(true),
})

/** GET /api/staff/checkout query */
export const checkoutQuerySchema = z.object({
  user_id: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  location_id: z.string().uuid().optional(),
})

/** GET /api/staff/overtime query */
export const overtimeQuerySchema = z.object({
  location_id: z.string().uuid().optional(),
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

/** GET /api/staff/break-compliance query */
export const breakComplianceQuerySchema = z.object({
  location_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
})

/** GET /api/staff/labor-forecast query */
export const laborForecastQuerySchema = z.object({
  location_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

/** POST /api/staff/payroll/export */
export const payrollExportSchema = z.object({
  location_id: z.string().uuid(),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  format: z.enum(['csv', 'json']).default('csv'),
})

/** POST /api/staff/permissions */
export const updatePermissionsSchema = z.object({
  user_id: z.string().uuid(),
  permissions: z.record(z.string(), z.boolean()),
})

/** Cash drawer schemas */
export const openCashDrawerSchema = z.object({
  location_id: z.string().uuid(),
  opening_amount: z.string().regex(/^\d+\.\d{2}$/).default('0.00'),
})

export const closeCashDrawerSchema = z.object({
  counted_amount: z.string().regex(/^\d+\.\d{2}$/),
  notes: z.string().max(500).optional(),
})

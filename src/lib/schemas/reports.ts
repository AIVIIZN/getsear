import { z } from 'zod'

/** Common query params for most report routes */
export const reportQuerySchema = z.object({
  location_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
})

/** GET /api/reports/dashboard query */
export const dashboardQuerySchema = z.object({
  location_id: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

/** GET /api/reports/daily query */
export const dailyReportQuerySchema = z.object({
  location_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

/** GET /api/reports/weekly query */
export const weeklyReportQuerySchema = z.object({
  location_id: z.string().uuid(),
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

/** GET /api/reports/monthly query */
export const monthlyReportQuerySchema = z.object({
  location_id: z.string().uuid(),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2100),
})

/** GET /api/reports/hourly query */
export const hourlyReportQuerySchema = z.object({
  location_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

/** GET /api/reports/pmix query */
export const pmixQuerySchema = z.object({
  location_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  category_id: z.string().uuid().optional(),
})

/** GET /api/reports/labor query */
export const laborQuerySchema = z.object({
  location_id: z.string().uuid(),
  date_from: z.string(),
  date_to: z.string(),
})

/** GET /api/reports/server-performance query */
export const serverPerfQuerySchema = z.object({
  location_id: z.string().uuid(),
  date_from: z.string(),
  date_to: z.string(),
  server_id: z.string().uuid().optional(),
})

/** GET /api/reports/speed-of-service query */
export const speedQuerySchema = z.object({
  location_id: z.string().uuid(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
})

/** GET /api/reports/payments query */
export const paymentsReportQuerySchema = z.object({
  location_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  payment_method: z.string().optional(),
})

/** GET /api/reports/tax query */
export const taxReportQuerySchema = z.object({
  location_id: z.string().uuid(),
  date_from: z.string(),
  date_to: z.string(),
})

/** GET /api/reports/cash query */
export const cashReportQuerySchema = z.object({
  location_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

/** GET /api/reports/voids-comps query */
export const voidsCompsQuerySchema = z.object({
  location_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
})

/** GET /api/reports/discounts query */
export const discountsQuerySchema = z.object({
  location_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
})

/** GET /api/reports/category-mix query */
export const categoryMixQuerySchema = z.object({
  location_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
})

/** GET /api/reports/food-cost query */
export const foodCostReportQuerySchema = z.object({
  location_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
})

/** GET /api/reports/trends query */
export const trendsQuerySchema = z.object({
  location_id: z.string().uuid().optional(),
  metric: z.enum(['sales', 'orders', 'avg_ticket', 'labor_cost']).optional(),
  period: z.enum(['day', 'week', 'month']).default('day'),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
})

/** GET /api/reports/pnl query */
export const pnlQuerySchema = z.object({
  location_id: z.string().uuid(),
  date_from: z.string(),
  date_to: z.string(),
})

/** POST /api/reports/export */
export const exportReportSchema = z.object({
  report_type: z.string().min(1),
  format: z.enum(['csv', 'pdf', 'xlsx']).default('csv'),
  location_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
})

/** POST /api/reports/email-daily */
export const emailDailySchema = z.object({
  location_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  recipients: z.array(z.string().email()).min(1),
})

/** POST /api/reports/custom */
export const customReportSchema = z.object({
  name: z.string().min(1).max(200),
  metrics: z.array(z.string()).min(1),
  dimensions: z.array(z.string()).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  date_from: z.string(),
  date_to: z.string(),
  location_id: z.string().uuid().optional(),
})

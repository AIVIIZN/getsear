import { z } from 'zod'

const tableShapes = ['square', 'round', 'rectangle', 'booth', 'bar'] as const
const tableStatuses = ['available', 'occupied', 'reserved', 'dirty', 'blocked'] as const

/** POST /api/tables */
export const createTableSchema = z.object({
  floor_plan_id: z.string().uuid(),
  name: z.string().min(1).max(50),
  capacity: z.number().int().min(1).max(50).default(4),
  shape: z.enum(tableShapes).default('square'),
  pos_x: z.number().min(0).default(100),
  pos_y: z.number().min(0).default(100),
  width: z.number().min(40).max(400).default(80),
  height: z.number().min(40).max(400).default(80),
  rotation: z.number().min(0).max(360).default(0),
  section: z.string().max(50).default(''),
  sort_order: z.number().int().min(0).optional(),
})

/** PATCH /api/tables/[id] */
export const updateTableSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  capacity: z.number().int().min(1).max(50).optional(),
  shape: z.enum(tableShapes).optional(),
  pos_x: z.number().min(0).optional(),
  pos_y: z.number().min(0).optional(),
  width: z.number().min(40).max(400).optional(),
  height: z.number().min(40).max(400).optional(),
  rotation: z.number().min(0).max(360).optional(),
  section: z.string().max(50).optional(),
  sort_order: z.number().int().min(0).optional(),
  status: z.enum(tableStatuses).optional(),
  is_active: z.boolean().optional(),
})

/** GET /api/tables query params */
export const listTablesQuerySchema = z.object({
  floor_plan_id: z.string().uuid().optional(),
  section: z.string().optional(),
  location_id: z.string().uuid().optional(),
  status: z.enum(tableStatuses).optional(),
})

/** POST /api/tables/[id]/seat */
export const seatTableSchema = z.object({
  guest_count: z.number().int().min(1).max(99),
  server_id: z.string().uuid().optional(),
  order_id: z.string().uuid().optional(),
  reservation_id: z.string().uuid().optional(),
})

/** POST /api/tables/[id]/clear */
export const clearTableSchema = z.object({
  reason: z.string().max(200).optional(),
})

/** POST /api/tables/bulk-update */
export const bulkUpdateTablesSchema = z.object({
  updates: z.array(z.object({
    id: z.string().uuid(),
    pos_x: z.number().min(0).optional(),
    pos_y: z.number().min(0).optional(),
    width: z.number().min(40).max(400).optional(),
    height: z.number().min(40).max(400).optional(),
    rotation: z.number().min(0).max(360).optional(),
    sort_order: z.number().int().min(0).optional(),
  })),
})

/** POST /api/tables/floor-plans */
export const createFloorPlanSchema = z.object({
  name: z.string().min(1).max(100),
  location_id: z.string().uuid(),
  is_active: z.boolean().default(true),
  background_image_url: z.string().url().optional().nullable(),
  width: z.number().min(200).max(2000).default(800),
  height: z.number().min(200).max(2000).default(600),
})

/** PATCH /api/tables/floor-plans/[id] */
export const updateFloorPlanSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  is_active: z.boolean().optional(),
  background_image_url: z.string().url().optional().nullable(),
  width: z.number().min(200).max(2000).optional(),
  height: z.number().min(200).max(2000).optional(),
})

/** POST /api/tables/sections */
export const createSectionSchema = z.object({
  name: z.string().min(1).max(50),
  location_id: z.string().uuid(),
  color: z.string().max(20).optional(),
})

/** POST /api/tables/sections/assign */
export const assignSectionSchema = z.object({
  section: z.string().min(1).max(50),
  server_id: z.string().uuid(),
  location_id: z.string().uuid(),
})

/** GET /api/tables/[id]/history query */
export const tableHistoryQuerySchema = z.object({
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

/** GET /api/tables/status-summary query */
export const statusSummaryQuerySchema = z.object({
  location_id: z.string().uuid().optional(),
})

/** GET /api/tables/turn-times query */
export const turnTimesQuerySchema = z.object({
  location_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
})

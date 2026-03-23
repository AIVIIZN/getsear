import { z } from 'zod'

/** POST /api/drive-thru/lanes */
export const createLaneSchema = z.object({
  name: z.string().min(1).max(100),
  location_id: z.string().uuid(),
  lane_number: z.number().int().min(1).max(10),
  is_active: z.boolean().default(true),
})

/** POST /api/drive-thru/lanes/[id]/cars */
export const addCarSchema = z.object({
  order_id: z.string().uuid().optional(),
  vehicle_description: z.string().max(200).optional(),
  position: z.number().int().min(1).optional(),
})

/** POST /api/drive-thru/orders */
export const createDriveThruOrderSchema = z.object({
  lane_id: z.string().uuid(),
  location_id: z.string().uuid(),
  items: z.array(z.object({
    menu_item_id: z.string().uuid(),
    quantity: z.number().int().min(1).max(99),
    notes: z.string().max(500).optional(),
    modifiers: z.array(z.object({
      modifier_id: z.string().uuid(),
    })).optional(),
  })).min(1),
})

/** PATCH /api/drive-thru/orders/[id] */
export const updateDriveThruOrderSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'ready', 'delivered', 'cancelled']).optional(),
  items: z.array(z.object({
    menu_item_id: z.string().uuid(),
    quantity: z.number().int().min(1).max(99),
    notes: z.string().max(500).optional(),
  })).optional(),
})

/** POST /api/drive-thru/menu-boards */
export const createMenuBoardSchema = z.object({
  name: z.string().min(1).max(100),
  location_id: z.string().uuid(),
  lane_id: z.string().uuid().optional(),
  content: z.record(z.string(), z.unknown()).optional(),
  is_active: z.boolean().default(true),
})

/** PATCH /api/drive-thru/menu-boards/[id] */
export const updateMenuBoardSchema = createMenuBoardSchema.partial()

/** GET /api/drive-thru/orders query */
export const listDriveThruOrdersQuerySchema = z.object({
  location_id: z.string().uuid().optional(),
  lane_id: z.string().uuid().optional(),
  status: z.string().optional(),
})

/** GET /api/drive-thru/speed-metrics query */
export const speedMetricsQuerySchema = z.object({
  location_id: z.string().uuid(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
})

/** GET /api/drive-thru/orders/metrics query */
export const orderMetricsQuerySchema = z.object({
  location_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

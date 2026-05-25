import { z } from 'zod'

const orderTypes = [
  'dine_in', 'takeout', 'delivery', 'bar', 'catering', 'online', 'kiosk', 'drive_thru', 'qr',
] as const

const orderStatuses = [
  'draft', 'open', 'fired', 'ready', 'served', 'closed', 'voided', 'refunded',
] as const

const orderSources = ['pos', 'online', 'kiosk', 'phone', 'catering'] as const

/** POST /api/orders */
export const createOrderSchema = z.object({
  order_type: z.enum(orderTypes),
  location_id: z.string().uuid(),
  table_id: z.string().uuid().optional().nullable(),
  guest_count: z.number().int().min(1).max(99).optional().default(1),
  guest_name: z.string().max(200).optional().nullable(),
  guest_phone: z.string().max(30).optional().nullable(),
  notes: z.string().max(2000).optional().default(''),
  source: z.enum(orderSources).optional().default('pos'),
  for_here: z.boolean().optional(),
})

/** GET /api/orders query params */
export const listOrdersQuerySchema = z.object({
  status: z.enum(orderStatuses).optional(),
  order_type: z.enum(orderTypes).optional(),
  server_id: z.string().uuid().optional(),
  location_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

/** GET /api/orders/active query params */
export const activeOrdersQuerySchema = z.object({
  location_id: z.string().uuid().optional(),
})

/** PATCH /api/orders/[id] */
export const updateOrderSchema = z.object({
  status: z.enum(orderStatuses).optional(),
  table_id: z.string().uuid().optional().nullable(),
  guest_count: z.number().int().min(1).max(99).optional(),
  guest_name: z.string().max(200).optional().nullable(),
  guest_phone: z.string().max(30).optional().nullable(),
  notes: z.string().max(2000).optional(),
  server_id: z.string().uuid().optional(),
})

/** POST /api/orders/[id]/items */
export const addOrderItemSchema = z.object({
  menu_item_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(99).default(1),
  price_cents: z.number().int().min(0),
  notes: z.string().max(500).optional().default(''),
  course: z.number().int().min(1).max(10).optional().default(1),
  seat_number: z.number().int().min(0).max(99).optional(),
  modifiers: z.array(z.object({
    modifier_id: z.string().uuid(),
    name: z.string(),
    price_cents: z.number().int().min(0).default(0),
  })).optional().default([]),
})

/** PATCH /api/orders/[id]/items/[itemId] */
export const updateOrderItemSchema = z.object({
  quantity: z.number().int().min(1).max(99).optional(),
  notes: z.string().max(500).optional(),
  course: z.number().int().min(1).max(10).optional(),
  seat_number: z.number().int().min(0).max(99).optional(),
  voided: z.boolean().optional(),
  void_reason: z.string().max(500).optional(),
})

/** POST /api/orders/[id]/send */
export const sendOrderSchema = z.object({
  courses: z.array(z.number().int().min(1)).optional(),
})

/** POST /api/orders/[id]/fire-course */
export const fireCourseSchema = z.object({
  course: z.number().int().min(1).max(10),
})

/** POST /api/orders/[id]/hold */
export const holdOrderSchema = z.object({
  reason: z.string().max(500).optional(),
})

/** POST /api/orders/[id]/discount */
export const orderDiscountSchema = z.object({
  discount_type: z.enum(['percent', 'fixed']),
  discount_value: z.number().min(0),
  reason: z.string().max(500).optional(),
  manager_pin: z.string().optional(),
})

/** POST /api/orders/[id]/comp */
export const orderCompSchema = z.object({
  reason: z.string().min(1).max(500),
  manager_pin: z.string().optional(),
  item_ids: z.array(z.string().uuid()).optional(),
})

/** POST /api/orders/[id]/split */
export const splitOrderSchema = z.object({
  split_type: z.enum(['even', 'by_seat', 'by_item', 'custom']),
  split_count: z.number().int().min(2).max(20).optional(),
  splits: z.array(z.object({
    item_ids: z.array(z.string().uuid()).optional(),
    amount_cents: z.number().int().min(0).optional(),
  })).optional(),
})

/** POST /api/orders/[id]/merge */
export const mergeOrderSchema = z.object({
  target_order_id: z.string().uuid(),
})

/** POST /api/orders/[id]/move-table */
export const moveTableSchema = z.object({
  table_id: z.string().uuid(),
})

/** POST /api/orders/[id]/transfer */
export const transferOrderSchema = z.object({
  server_id: z.string().uuid(),
})

/** POST /api/orders/[id]/auto-gratuity */
export const autoGratuitySchema = z.object({
  percent: z.number().min(0).max(100),
})

/** POST /api/orders/[id]/walkout */
export const walkoutSchema = z.object({
  manager_pin: z.string().optional(),
  notes: z.string().max(500).optional(),
})

/** POST /api/orders/[id]/items/[itemId]/refire */
export const refireItemSchema = z.object({
  reason: z.string().max(500).optional(),
})

/** Route params with id */
export const orderIdParamsSchema = z.object({
  id: z.string().uuid(),
})

export const orderItemParamsSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
})

export type CreateOrderInput = z.infer<typeof createOrderSchema>
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>
export type AddOrderItemInput = z.infer<typeof addOrderItemSchema>

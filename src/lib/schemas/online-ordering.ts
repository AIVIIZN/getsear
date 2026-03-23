import { z } from 'zod'

/** POST /api/online-ordering/menus */
export const createOnlineMenuSchema = z.object({
  name: z.string().min(1).max(200),
  location_id: z.string().uuid(),
  is_active: z.boolean().default(true),
  category_ids: z.array(z.string().uuid()).default([]),
  availability: z.object({
    days: z.array(z.number().int().min(0).max(6)).default([0, 1, 2, 3, 4, 5, 6]),
    start_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    end_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  }).optional(),
})

/** PATCH /api/online-ordering/menus/[id] */
export const updateOnlineMenuSchema = createOnlineMenuSchema.partial()

/** PATCH /api/online-ordering/menus/[id]/items */
export const updateMenuItemsSchema = z.object({
  add_item_ids: z.array(z.string().uuid()).optional(),
  remove_item_ids: z.array(z.string().uuid()).optional(),
  item_overrides: z.array(z.object({
    menu_item_id: z.string().uuid(),
    online_price: z.string().regex(/^\d+\.\d{2}$/).optional(),
    is_available: z.boolean().optional(),
  })).optional(),
})

/** POST /api/online-ordering/public/order */
export const publicOrderSchema = z.object({
  location_id: z.string().uuid(),
  customer_name: z.string().min(1).max(200),
  customer_phone: z.string().max(20),
  customer_email: z.string().email().optional(),
  order_type: z.enum(['takeout', 'delivery']),
  scheduled_for: z.string().datetime({ offset: true }).optional(),
  items: z.array(z.object({
    menu_item_id: z.string().uuid(),
    quantity: z.number().int().min(1).max(99),
    notes: z.string().max(500).optional(),
    modifiers: z.array(z.object({
      modifier_id: z.string().uuid(),
    })).optional(),
  })).min(1),
  delivery_address: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
  tip_cents: z.number().int().min(0).default(0),
})

/** PATCH /api/online-ordering/settings */
export const updateSettingsSchema = z.object({
  is_enabled: z.boolean().optional(),
  max_orders_per_window: z.number().int().min(0).optional(),
  throttle_window_minutes: z.number().int().min(1).optional(),
  minimum_order_cents: z.number().int().min(0).optional(),
  max_scheduled_days_ahead: z.number().int().min(0).optional(),
  auto_accept: z.boolean().optional(),
  location_id: z.string().uuid(),
})

/** POST /api/online-ordering/qr */
export const generateQrSchema = z.object({
  location_id: z.string().uuid(),
  table_id: z.string().uuid().optional(),
  type: z.enum(['menu', 'order', 'reservation']).default('order'),
})

/** POST /api/online-ordering/queue/[id]/accept */
export const acceptOrderSchema = z.object({
  estimated_minutes: z.number().int().min(1).max(240).optional(),
})

/** POST /api/online-ordering/queue/[id]/reject */
export const rejectOrderSchema = z.object({
  reason: z.string().min(1).max(500),
})

/** GET /api/online-ordering/queue query */
export const queueQuerySchema = z.object({
  location_id: z.string().uuid(),
  status: z.enum(['pending', 'accepted', 'rejected', 'ready', 'completed']).optional(),
})

/** GET /api/online-ordering/public/menu query */
export const publicMenuQuerySchema = z.object({
  location_id: z.string().uuid(),
})

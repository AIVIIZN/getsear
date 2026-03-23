import { z } from 'zod'

/** POST /api/inventory/items */
export const createInventoryItemSchema = z.object({
  name: z.string().min(1).max(200),
  unit: z.string().min(1).max(50),
  par_level: z.number().min(0).default(0),
  reorder_point: z.number().min(0).default(0),
  current_stock: z.number().min(0).default(0),
  unit_cost: z.string().default('0.00'),
  category: z.string().max(100).optional().nullable(),
  supplier_id: z.string().uuid().optional().nullable(),
  location_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().default(true),
})

/** PATCH /api/inventory/items/[id] */
export const updateInventoryItemSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  unit: z.string().min(1).max(50).optional(),
  par_level: z.number().min(0).optional(),
  reorder_point: z.number().min(0).optional(),
  current_stock: z.number().min(0).optional(),
  unit_cost: z.string().optional(),
  category: z.string().max(100).optional().nullable(),
  supplier_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().optional(),
})

/** GET /api/inventory/items query */
export const listInventoryQuerySchema = z.object({
  category: z.string().optional(),
  low_stock: z.coerce.boolean().optional(),
  search: z.string().optional(),
  location_id: z.string().uuid().optional(),
})

/** POST /api/inventory/items/[id]/count */
export const countSchema = z.object({
  counted_quantity: z.number().min(0),
  notes: z.string().max(500).optional(),
  location_id: z.string().uuid().optional(),
})

/** POST /api/inventory/purchase-orders */
export const createPurchaseOrderSchema = z.object({
  vendor_id: z.string().uuid(),
  location_id: z.string().uuid(),
  expected_delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(2000).optional(),
  items: z.array(z.object({
    inventory_item_id: z.string().uuid(),
    quantity: z.number().min(0.01),
    unit_cost: z.string().regex(/^\d+\.\d{2}$/),
  })).min(1),
})

/** PATCH /api/inventory/purchase-orders/[id] */
export const updatePurchaseOrderSchema = z.object({
  status: z.enum(['draft', 'sent', 'received', 'cancelled']).optional(),
  expected_delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(2000).optional(),
  items: z.array(z.object({
    inventory_item_id: z.string().uuid(),
    quantity: z.number().min(0.01),
    unit_cost: z.string().regex(/^\d+\.\d{2}$/),
  })).optional(),
})

/** POST /api/inventory/purchase-orders/[id]/receive */
export const receivePurchaseOrderSchema = z.object({
  items: z.array(z.object({
    inventory_item_id: z.string().uuid(),
    received_quantity: z.number().min(0),
    notes: z.string().max(500).optional(),
  })),
})

/** POST /api/inventory/purchase-orders/[id]/reconcile */
export const reconcilePurchaseOrderSchema = z.object({
  adjustments: z.array(z.object({
    inventory_item_id: z.string().uuid(),
    final_quantity: z.number().min(0),
    reason: z.string().max(500).optional(),
  })),
})

/** POST /api/inventory/vendors */
export const createVendorSchema = z.object({
  name: z.string().min(1).max(200),
  contact_name: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  address: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  payment_terms: z.string().max(100).optional(),
})

/** PATCH /api/inventory/vendors/[id] */
export const updateVendorSchema = createVendorSchema.partial()

/** POST /api/inventory/waste */
export const recordWasteSchema = z.object({
  inventory_item_id: z.string().uuid(),
  quantity: z.number().min(0.01),
  reason: z.enum(['spoilage', 'damage', 'overproduction', 'expired', 'other']),
  notes: z.string().max(500).optional(),
  location_id: z.string().uuid(),
})

/** POST /api/inventory/recipes */
export const createRecipeSchema = z.object({
  menu_item_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  yield_quantity: z.number().min(0.01).default(1),
  yield_unit: z.string().max(50).default('portion'),
  ingredients: z.array(z.object({
    inventory_item_id: z.string().uuid(),
    quantity: z.number().min(0.001),
  })).min(1),
  instructions: z.string().max(5000).optional(),
})

/** PATCH /api/inventory/recipes/[id] */
export const updateRecipeSchema = createRecipeSchema.partial()

/** GET /api/inventory/food-cost query */
export const foodCostQuerySchema = z.object({
  location_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  category: z.string().optional(),
})

/** GET /api/inventory/prep-list query */
export const prepListQuerySchema = z.object({
  location_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

/** GET /api/inventory/alerts query */
export const alertsQuerySchema = z.object({
  location_id: z.string().uuid().optional(),
  type: z.enum(['low_stock', 'expired', 'reorder']).optional(),
})

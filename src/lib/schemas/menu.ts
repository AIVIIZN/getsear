import { z } from 'zod'

/** POST /api/menu/categories */
export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().default(''),
  color: z.string().max(20).optional().default(''),
  icon: z.string().max(50).optional().default(''),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().default(true),
  location_id: z.string().uuid().optional(),
})

/** PATCH /api/menu/categories/[id] */
export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  color: z.string().max(20).optional(),
  icon: z.string().max(50).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
})

/** POST /api/menu/categories/reorder */
export const reorderCategoriesSchema = z.object({
  order: z.array(z.object({
    id: z.string().uuid(),
    sort_order: z.number().int().min(0),
  })),
})

/** POST /api/menu/items */
export const createMenuItemSchema = z.object({
  category_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().default(''),
  price: z.string().regex(/^\d+\.\d{2}$/).default('0.00'),
  cost: z.string().regex(/^\d+\.\d{2}$/).optional().default('0.00'),
  sku: z.string().max(50).optional().default(''),
  barcode: z.string().max(50).optional().default(''),
  color: z.string().max(20).optional().default(''),
  image_url: z.string().url().optional().nullable(),
  is_taxable: z.boolean().default(true),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().min(0).optional(),
  prep_time_minutes: z.number().int().min(0).optional(),
  allergens: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  dietary_flags: z.array(z.string()).default([]),
  modifier_group_ids: z.array(z.string().uuid()).optional().default([]),
  price_levels: z.record(z.string(), z.string()).optional().default({}),
  location_id: z.string().uuid().optional(),
})

/** PATCH /api/menu/items/[id] */
export const updateMenuItemSchema = z.object({
  category_id: z.string().uuid().optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  price: z.string().regex(/^\d+\.\d{2}$/).optional(),
  cost: z.string().regex(/^\d+\.\d{2}$/).optional(),
  sku: z.string().max(50).optional(),
  barcode: z.string().max(50).optional(),
  color: z.string().max(20).optional(),
  image_url: z.string().url().optional().nullable(),
  is_taxable: z.boolean().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
  prep_time_minutes: z.number().int().min(0).optional(),
  allergens: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  dietary_flags: z.array(z.string()).optional(),
  modifier_group_ids: z.array(z.string().uuid()).optional(),
  price_levels: z.record(z.string(), z.string()).optional(),
})

/** POST /api/menu/items/reorder */
export const reorderItemsSchema = z.object({
  order: z.array(z.object({
    id: z.string().uuid(),
    sort_order: z.number().int().min(0),
  })),
})

/** POST /api/menu/items/[id]/86 */
export const toggle86Schema = z.object({
  is_86: z.boolean(),
  reason: z.string().max(500).optional(),
})

/** POST /api/menu/modifier-groups */
export const createModifierGroupSchema = z.object({
  name: z.string().min(1).max(100),
  min_selections: z.number().int().min(0).default(0),
  max_selections: z.number().int().min(0).default(10),
  is_required: z.boolean().default(false),
  sort_order: z.number().int().min(0).optional(),
  modifiers: z.array(z.object({
    name: z.string().min(1).max(100),
    price: z.string().regex(/^\d+\.\d{2}$/).default('0.00'),
    sort_order: z.number().int().min(0).optional(),
    is_default: z.boolean().default(false),
  })).optional().default([]),
})

/** PATCH /api/menu/modifier-groups/[id] */
export const updateModifierGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  min_selections: z.number().int().min(0).optional(),
  max_selections: z.number().int().min(0).optional(),
  is_required: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
  modifiers: z.array(z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(100),
    price: z.string().regex(/^\d+\.\d{2}$/).default('0.00'),
    sort_order: z.number().int().min(0).optional(),
    is_default: z.boolean().default(false),
  })).optional(),
})

/** GET /api/menu/items query params */
export const listMenuItemsQuerySchema = z.object({
  category_id: z.string().uuid().optional(),
  location_id: z.string().uuid().optional(),
  search: z.string().optional(),
  is_active: z.coerce.boolean().optional(),
  is_86: z.coerce.boolean().optional(),
})

/** GET /api/menu/categories query params */
export const listCategoriesQuerySchema = z.object({
  location_id: z.string().uuid().optional(),
  is_active: z.coerce.boolean().optional(),
})

/** POST /api/menu/items/bulk */
export const bulkMenuItemsSchema = z.object({
  action: z.enum(['activate', 'deactivate', '86', 'un86', 'delete']),
  item_ids: z.array(z.string().uuid()).min(1).max(500),
})

/** Menu item import schema */
export const importMenuItemsSchema = z.object({
  items: z.array(z.object({
    name: z.string().min(1).max(200),
    category_name: z.string().max(100),
    price: z.string().regex(/^\d+\.\d{2}$/),
    description: z.string().max(1000).optional(),
  })).min(1).max(1000),
})

/** Daypart schemas */
export const createDaypartSchema = z.object({
  name: z.string().min(1).max(100),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  days: z.array(z.number().int().min(0).max(6)),
  category_ids: z.array(z.string().uuid()).default([]),
  location_id: z.string().uuid().optional(),
  is_active: z.boolean().default(true),
})

export const updateDaypartSchema = createDaypartSchema.partial()

/** Photo schemas */
export const uploadPhotoSchema = z.object({
  menu_item_id: z.string().uuid(),
  url: z.string().url(),
  is_primary: z.boolean().default(false),
})

/** Seasonal menu */
export const seasonalMenuSchema = z.object({
  name: z.string().min(1).max(200),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  item_ids: z.array(z.string().uuid()),
  location_id: z.string().uuid().optional(),
})

/** Ingredient schemas */
export const createIngredientSchema = z.object({
  name: z.string().min(1).max(200),
  unit: z.string().max(50).default('each'),
  cost_per_unit: z.string().regex(/^\d+\.\d{2}$/).default('0.00'),
  allergens: z.array(z.string()).default([]),
})

export const ingredient86Schema = z.object({
  is_86: z.boolean(),
})

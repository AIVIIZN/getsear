import { z } from 'zod'

/** POST /api/scheduling/shifts */
export const createShiftSchema = z.object({
  user_id: z.string().uuid(),
  location_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  position: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
  is_published: z.boolean().default(false),
})

/** PATCH /api/scheduling/shifts/[id] */
export const updateShiftSchema = createShiftSchema.partial()

/** GET /api/scheduling/shifts query */
export const listShiftsQuerySchema = z.object({
  location_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  is_published: z.coerce.boolean().optional(),
})

/** POST /api/scheduling/shifts/open */
export const createOpenShiftSchema = z.object({
  location_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  position: z.string().max(50),
  notes: z.string().max(500).optional(),
})

/** POST /api/scheduling/shifts/[id]/pickup */
export const pickupShiftSchema = z.object({
  user_id: z.string().uuid().optional(),
})

/** POST /api/scheduling/swap-requests */
export const createSwapRequestSchema = z.object({
  from_shift_id: z.string().uuid(),
  to_shift_id: z.string().uuid().optional(),
  to_user_id: z.string().uuid().optional(),
  reason: z.string().max(500).optional(),
})

/** PATCH /api/scheduling/swap-requests/[id] */
export const updateSwapRequestSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']),
  notes: z.string().max(500).optional(),
})

/** POST /api/scheduling/templates */
export const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  location_id: z.string().uuid(),
  shifts: z.array(z.object({
    day_of_week: z.number().int().min(0).max(6),
    start_time: z.string().regex(/^\d{2}:\d{2}$/),
    end_time: z.string().regex(/^\d{2}:\d{2}$/),
    position: z.string().max(50),
    count: z.number().int().min(1).default(1),
  })),
})

/** PATCH /api/scheduling/templates/[id] */
export const updateTemplateSchema = createTemplateSchema.partial()

/** POST /api/scheduling/publish */
export const publishScheduleSchema = z.object({
  location_id: z.string().uuid(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notify_staff: z.boolean().default(true),
})

/** PUT /api/scheduling/availability */
export const updateAvailabilitySchema = z.object({
  user_id: z.string().uuid().optional(),
  availability: z.array(z.object({
    day_of_week: z.number().int().min(0).max(6),
    start_time: z.string().regex(/^\d{2}:\d{2}$/),
    end_time: z.string().regex(/^\d{2}:\d{2}$/),
    is_available: z.boolean().default(true),
  })),
})

/** GET /api/scheduling/availability query */
export const availabilityQuerySchema = z.object({
  user_id: z.string().uuid().optional(),
  location_id: z.string().uuid().optional(),
})

/** GET /api/scheduling/labor-forecast query */
export const laborForecastQuerySchema = z.object({
  location_id: z.string().uuid(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

/** POST /api/scheduling/marketplace/[id]/claim */
export const claimShiftSchema = z.object({
  user_id: z.string().uuid().optional(),
})

/** GET /api/scheduling/marketplace query */
export const marketplaceQuerySchema = z.object({
  location_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
})

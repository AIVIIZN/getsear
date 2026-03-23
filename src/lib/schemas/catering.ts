import { z } from 'zod'

/** POST /api/catering/events */
export const createEventSchema = z.object({
  customer_name: z.string().min(1).max(200),
  customer_phone: z.string().max(20).optional(),
  customer_email: z.string().email().optional(),
  event_name: z.string().min(1).max(200),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  event_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  guest_count: z.number().int().min(1).max(10000),
  location_id: z.string().uuid().optional(),
  venue: z.string().max(500).optional(),
  notes: z.string().max(5000).optional(),
  menu_id: z.string().uuid().optional(),
  deposit_required_cents: z.number().int().min(0).default(0),
})

/** PATCH /api/catering/events/[id] */
export const updateEventSchema = createEventSchema.partial().extend({
  status: z.enum(['inquiry', 'proposal_sent', 'confirmed', 'in_progress', 'completed', 'cancelled']).optional(),
})

/** POST /api/catering/events/[id]/beo */
export const createBeoSchema = z.object({
  sections: z.array(z.object({
    title: z.string().min(1).max(200),
    content: z.string().max(5000),
    sort_order: z.number().int().min(0).default(0),
  })),
  notes: z.string().max(5000).optional(),
})

/** POST /api/catering/events/[id]/proposal */
export const createProposalSchema = z.object({
  items: z.array(z.object({
    name: z.string().min(1),
    description: z.string().max(500).optional(),
    quantity: z.number().int().min(1),
    unit_price_cents: z.number().int().min(0),
  })).min(1),
  notes: z.string().max(5000).optional(),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  terms: z.string().max(5000).optional(),
})

/** POST /api/catering/events/[id]/deposit */
export const recordDepositSchema = z.object({
  amount_cents: z.number().int().min(1),
  payment_method: z.enum(['card', 'cash', 'check', 'wire']),
  reference: z.string().max(200).optional(),
})

/** POST /api/catering/events/[id]/invoice */
export const createInvoiceSchema = z.object({
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(2000).optional(),
  include_deposit: z.boolean().default(true),
})

/** POST /api/catering/menus */
export const createCateringMenuSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  categories: z.array(z.object({
    name: z.string().min(1).max(100),
    items: z.array(z.object({
      name: z.string().min(1).max(200),
      description: z.string().max(500).optional(),
      price_per_person_cents: z.number().int().min(0),
    })),
  })).optional(),
  min_guests: z.number().int().min(1).default(1),
  max_guests: z.number().int().min(1).default(500),
})

/** PATCH /api/catering/menus/[id] */
export const updateCateringMenuSchema = createCateringMenuSchema.partial()

/** GET /api/catering/events query */
export const listEventsQuerySchema = z.object({
  status: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  location_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

/** GET /api/catering/calendar query */
export const calendarQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2100),
  location_id: z.string().uuid().optional(),
})

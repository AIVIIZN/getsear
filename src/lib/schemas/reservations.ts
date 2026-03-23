import { z } from 'zod'

const reservationStatuses = ['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'] as const

/** POST /api/reservations */
export const createReservationSchema = z.object({
  customer_name: z.string().min(1).max(200),
  customer_phone: z.string().max(20).optional().nullable(),
  customer_email: z.string().email().optional().nullable(),
  party_size: z.number().int().min(1).max(100),
  reservation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reservation_time: z.string().regex(/^\d{2}:\d{2}$/),
  table_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  special_requests: z.string().max(2000).optional().nullable(),
  location_id: z.string().uuid().optional(),
})

/** PATCH /api/reservations/[id] */
export const updateReservationSchema = z.object({
  customer_name: z.string().min(1).max(200).optional(),
  customer_phone: z.string().max(20).optional().nullable(),
  customer_email: z.string().email().optional().nullable(),
  party_size: z.number().int().min(1).max(100).optional(),
  reservation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reservation_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  table_id: z.string().uuid().optional().nullable(),
  status: z.enum(reservationStatuses).optional(),
  notes: z.string().max(2000).optional().nullable(),
  special_requests: z.string().max(2000).optional().nullable(),
})

/** GET /api/reservations query params */
export const listReservationsQuerySchema = z.object({
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  status: z.enum(reservationStatuses).optional(),
  location_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

/** POST /api/reservations/[id]/confirm */
export const confirmReservationSchema = z.object({
  send_notification: z.boolean().default(true),
})

/** POST /api/reservations/[id]/seat */
export const seatReservationSchema = z.object({
  table_id: z.string().uuid(),
})

/** GET /api/reservations/availability query */
export const availabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  party_size: z.coerce.number().int().min(1).max(100),
  location_id: z.string().uuid().optional(),
})

/** POST /api/reservations/waitlist */
export const createWaitlistSchema = z.object({
  customer_name: z.string().min(1).max(200),
  customer_phone: z.string().max(20).optional().nullable(),
  party_size: z.number().int().min(1).max(100),
  quoted_wait_minutes: z.number().int().min(0).optional(),
  notes: z.string().max(500).optional().nullable(),
  location_id: z.string().uuid().optional(),
})

/** PATCH /api/reservations/waitlist/[id] */
export const updateWaitlistSchema = z.object({
  status: z.enum(['waiting', 'notified', 'seated', 'left', 'cancelled']).optional(),
  quoted_wait_minutes: z.number().int().min(0).optional(),
  notes: z.string().max(500).optional().nullable(),
})

/** POST /api/reservations/waitlist/[id]/seat */
export const seatWaitlistSchema = z.object({
  table_id: z.string().uuid(),
})

/** Public reservation schemas */
export const publicReservationQuerySchema = z.object({
  slug: z.string().min(1),
})

export const publicBookReservationSchema = z.object({
  customer_name: z.string().min(1).max(200),
  customer_phone: z.string().max(20),
  customer_email: z.string().email().optional(),
  party_size: z.number().int().min(1).max(20),
  reservation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reservation_time: z.string().regex(/^\d{2}:\d{2}$/),
  special_requests: z.string().max(500).optional(),
})

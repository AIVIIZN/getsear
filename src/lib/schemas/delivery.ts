import { z } from 'zod'

/** POST /api/delivery/deliveries */
export const createDeliverySchema = z.object({
  order_id: z.string().uuid(),
  location_id: z.string().uuid(),
  customer_name: z.string().min(1).max(200),
  customer_phone: z.string().max(20),
  delivery_address: z.string().min(1).max(500),
  delivery_notes: z.string().max(500).optional(),
  estimated_delivery_minutes: z.number().int().min(1).optional(),
})

/** PATCH /api/delivery/deliveries/[id] */
export const updateDeliverySchema = z.object({
  status: z.enum(['pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled']).optional(),
  driver_id: z.string().uuid().optional(),
  delivery_notes: z.string().max(500).optional(),
  actual_delivery_at: z.string().datetime({ offset: true }).optional(),
})

/** POST /api/delivery/deliveries/[id]/assign */
export const assignDriverSchema = z.object({
  driver_id: z.string().uuid(),
})

/** POST /api/delivery/deliveries/[id]/status */
export const updateDeliveryStatusSchema = z.object({
  status: z.enum(['pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled']),
  notes: z.string().max(500).optional(),
})

/** POST /api/delivery/gps */
export const gpsUpdateSchema = z.object({
  delivery_id: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy_meters: z.number().min(0).optional(),
})

/** POST /api/delivery/proof */
export const deliveryProofSchema = z.object({
  delivery_id: z.string().uuid(),
  photo_url: z.string().url().optional(),
  signature_url: z.string().url().optional(),
  notes: z.string().max(500).optional(),
})

/** POST /api/delivery/zones */
export const createZoneSchema = z.object({
  name: z.string().min(1).max(100),
  location_id: z.string().uuid(),
  delivery_fee_cents: z.number().int().min(0).default(0),
  min_order_cents: z.number().int().min(0).default(0),
  estimated_minutes: z.number().int().min(1).default(30),
  polygon: z.array(z.object({
    lat: z.number(),
    lng: z.number(),
  })).min(3).optional(),
  zip_codes: z.array(z.string()).optional(),
  is_active: z.boolean().default(true),
})

/** PATCH /api/delivery/zones/[id] */
export const updateZoneSchema = createZoneSchema.partial()

/** GET /api/delivery/deliveries query */
export const listDeliveriesQuerySchema = z.object({
  location_id: z.string().uuid().optional(),
  status: z.string().optional(),
  driver_id: z.string().uuid().optional(),
  date: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

/** GET /api/delivery/track/[id] — public tracking, no auth needed */
export const trackDeliveryParamsSchema = z.object({
  id: z.string().uuid(),
})

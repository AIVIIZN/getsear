import { z } from 'zod'

/** POST /api/kds/stations */
export const createStationSchema = z.object({
  name: z.string().min(1).max(100),
  location_id: z.string().uuid(),
  station_type: z.enum(['grill', 'fry', 'saute', 'salad', 'dessert', 'expo', 'bar', 'general']).default('general'),
  display_order: z.number().int().min(0).default(0),
  settings: z.record(z.string(), z.unknown()).optional(),
})

/** PATCH /api/kds/stations/[id] */
export const updateStationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  station_type: z.enum(['grill', 'fry', 'saute', 'salad', 'dessert', 'expo', 'bar', 'general']).optional(),
  display_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
})

/** GET /api/kds/tickets query params */
export const listTicketsQuerySchema = z.object({
  station_id: z.string().uuid().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'recalled']).optional(),
  location_id: z.string().uuid().optional(),
})

/** POST /api/kds/tickets/[id]/bump */
export const bumpTicketSchema = z.object({
  station_id: z.string().uuid().optional(),
})

/** POST /api/kds/tickets/[id]/recall */
export const recallTicketSchema = z.object({
  reason: z.string().max(200).optional(),
})

/** POST /api/kds/tickets/[id]/items/[itemId]/bump */
export const bumpItemSchema = z.object({
  station_id: z.string().uuid().optional(),
})

/** POST /api/kds/tickets/[id]/items/[itemId]/refire */
export const refireKdsItemSchema = z.object({
  reason: z.string().max(200).optional(),
})

/** POST /api/kds/tickets/bump-all */
export const bumpAllSchema = z.object({
  station_id: z.string().uuid(),
})

/** PATCH /api/kds/stations/[id]/config */
export const stationConfigSchema = z.object({
  alert_threshold_seconds: z.number().int().min(0).optional(),
  auto_bump_seconds: z.number().int().min(0).optional(),
  display_mode: z.enum(['grid', 'list']).optional(),
  font_size: z.enum(['small', 'medium', 'large']).optional(),
  color_scheme: z.record(z.string(), z.string()).optional(),
})

/** POST /api/kds/stations/[id]/heartbeat */
export const stationHeartbeatSchema = z.object({
  terminal_id: z.string().uuid().optional(),
})

/** POST /api/kds/stations/[id]/status */
export const stationStatusSchema = z.object({
  status: z.enum(['online', 'offline', 'paused']),
})

/** POST /api/kds/messages */
export const createMessageSchema = z.object({
  from_station_id: z.string().uuid(),
  to_station_id: z.string().uuid().optional(),
  message: z.string().min(1).max(500),
  priority: z.enum(['normal', 'urgent']).default('normal'),
})

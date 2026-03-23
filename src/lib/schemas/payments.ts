import { z } from 'zod'

/** POST /api/payments/process */
export const processPaymentSchema = z.object({
  order_id: z.string().uuid(),
  payment_method: z.enum(['card', 'cash', 'gift_card', 'house_account', 'other']),
  amount_cents: z.number().int().min(1),
  tip_cents: z.number().int().min(0).default(0),
  location_id: z.string().uuid(),
  terminal_id: z.string().uuid().optional(),
  card_data: z.object({
    last_four: z.string().length(4).optional(),
    card_brand: z.string().max(20).optional(),
    entry_mode: z.enum(['swipe', 'chip', 'tap', 'manual', 'online']).optional(),
  }).optional(),
  cash_tendered_cents: z.number().int().min(0).optional(),
  gift_card_number: z.string().max(50).optional(),
  house_account_id: z.string().uuid().optional(),
})

/** POST /api/payments/capture */
export const capturePaymentSchema = z.object({
  payment_id: z.string().uuid(),
  tip_cents: z.number().int().min(0).optional().default(0),
})

/** POST /api/payments/void */
export const voidPaymentSchema = z.object({
  payment_id: z.string().uuid(),
  reason: z.string().max(500).optional(),
  manager_pin: z.string().optional(),
})

/** POST /api/payments/refund */
export const refundPaymentSchema = z.object({
  payment_id: z.string().uuid(),
  amount_cents: z.number().int().min(1),
  reason: z.string().max(500).optional(),
  manager_pin: z.string().optional(),
})

/** POST /api/payments/preauth */
export const preauthPaymentSchema = z.object({
  order_id: z.string().uuid(),
  amount_cents: z.number().int().min(1),
  location_id: z.string().uuid(),
  terminal_id: z.string().uuid().optional(),
})

/** POST /api/payments/preauth/[id]/capture */
export const preauthCaptureSchema = z.object({
  tip_cents: z.number().int().min(0).default(0),
})

/** POST /api/payments/preauth/[id]/increment */
export const preauthIncrementSchema = z.object({
  additional_cents: z.number().int().min(1),
})

/** POST /api/payments/settlement */
export const settlementSchema = z.object({
  location_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

/** POST /api/payments/tip-adjust */
export const tipAdjustSchema = z.object({
  payment_id: z.string().uuid(),
  tip_cents: z.number().int().min(0),
})

/** POST /api/payments/reconciliation */
export const reconciliationSchema = z.object({
  location_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

/** POST /api/payments/gift-card/activate */
export const giftCardActivateSchema = z.object({
  card_number: z.string().min(1).max(50),
  amount_cents: z.number().int().min(100),
  location_id: z.string().uuid(),
})

/** POST /api/payments/gift-card/check-balance */
export const giftCardBalanceSchema = z.object({
  card_number: z.string().min(1).max(50),
})

/** POST /api/payments/gift-card/reload */
export const giftCardReloadSchema = z.object({
  card_number: z.string().min(1).max(50),
  amount_cents: z.number().int().min(100),
  location_id: z.string().uuid(),
})

/** GET /api/payments/chargebacks query */
export const chargebacksQuerySchema = z.object({
  location_id: z.string().uuid().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export type ProcessPaymentInput = z.infer<typeof processPaymentSchema>
export type CapturePaymentInput = z.infer<typeof capturePaymentSchema>

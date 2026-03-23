/**
 * Price Resolver
 *
 * Resolves the effective price for any menu item given full context:
 * daypart, price level, promotions, manual overrides.
 *
 * Priority chain (highest to lowest):
 *   1. Manual Override (manager-applied)
 *   2. Promotion / Coupon
 *   3. Daypart pricing (via price_level_schedules)
 *   4. Menu-specific pricing (price_level_prices without daypart)
 *   5. Base item price
 *
 * All calculations use integer cents to avoid floating-point rounding.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PriceSource =
  | 'manual_override'
  | 'promotion'
  | 'daypart'
  | 'price_level'
  | 'base_price'

export interface ResolvedPrice {
  /** Effective price in integer cents */
  effectivePriceCents: number
  /** Which layer produced this price */
  source: PriceSource
  /** Name of the price level (if applicable) */
  priceLevelName: string | null
  /** Name of the daypart (if applicable) */
  daypartName: string | null
}

export interface PriceLevelPrice {
  id: string
  price_level_id: string
  level_name: string
  /** Dollar string from DB, e.g. "12.99" */
  price: string
  /** Optional daypart binding */
  daypart_id: string | null
}

export interface ManualOverride {
  /** Override price in integer cents */
  priceCents: number
  /** Who applied it */
  appliedBy: string
}

export interface PromotionPrice {
  /** Promotional price in integer cents */
  priceCents: number
  /** Promotion name for display */
  promotionName: string
}

export interface PriceResolverContext {
  /** Base item price in dollar string from DB (e.g. "14.99") */
  basePrice: string
  /** All price level prices configured for this item */
  priceLevelPrices: PriceLevelPrice[]
  /** Active daypart ID (if any) */
  activeDaypartId: string | null
  /** Active daypart name (if any) */
  activeDaypartName: string | null
  /** Manual price override (if manager applied one) */
  manualOverride: ManualOverride | null
  /** Active promotion (if applicable) */
  promotion: PromotionPrice | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a dollar string ("12.99") to integer cents (1299).
 * Handles edge cases: missing decimals, single decimal, etc.
 */
export function dollarsToCents(dollars: string): number {
  const cleaned = dollars.replace(/[^0-9.-]/g, '')
  const num = parseFloat(cleaned)
  if (isNaN(num)) return 0
  return Math.round(num * 100)
}

/**
 * Convert integer cents (1299) to a dollar string ("12.99").
 */
export function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2)
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/**
 * Resolve the effective price for a menu item.
 *
 * Walks the priority chain top-to-bottom:
 *   1. Manual Override
 *   2. Promotion
 *   3. Daypart-bound price level
 *   4. Generic price level (no daypart)
 *   5. Base price
 */
export function resolvePrice(ctx: PriceResolverContext): ResolvedPrice {
  // 1. Manual override (highest priority)
  if (ctx.manualOverride) {
    return {
      effectivePriceCents: ctx.manualOverride.priceCents,
      source: 'manual_override',
      priceLevelName: null,
      daypartName: null,
    }
  }

  // 2. Promotion / coupon
  if (ctx.promotion) {
    return {
      effectivePriceCents: ctx.promotion.priceCents,
      source: 'promotion',
      priceLevelName: ctx.promotion.promotionName,
      daypartName: null,
    }
  }

  // 3. Daypart-specific price level
  if (ctx.activeDaypartId) {
    const daypartPrice = ctx.priceLevelPrices.find(
      (plp) => plp.daypart_id === ctx.activeDaypartId
    )
    if (daypartPrice) {
      return {
        effectivePriceCents: dollarsToCents(daypartPrice.price),
        source: 'daypart',
        priceLevelName: daypartPrice.level_name,
        daypartName: ctx.activeDaypartName,
      }
    }
  }

  // 4. Generic price level (no daypart, but a named level that's "always on")
  // If there are price levels without daypart bindings, find the first active one.
  // In practice the POS picks a level based on schedule; this handles the fallback
  // where a price level is selected explicitly (e.g. "Employee" price).
  const genericLevel = ctx.priceLevelPrices.find(
    (plp) => plp.daypart_id === null
  )
  if (genericLevel) {
    return {
      effectivePriceCents: dollarsToCents(genericLevel.price),
      source: 'price_level',
      priceLevelName: genericLevel.level_name,
      daypartName: null,
    }
  }

  // 5. Base price (lowest priority)
  return {
    effectivePriceCents: dollarsToCents(ctx.basePrice),
    source: 'base_price',
    priceLevelName: null,
    daypartName: null,
  }
}

/**
 * Resolve prices for multiple items at once (batch).
 * Used by the "active prices" endpoint.
 */
export function resolvePricesBatch(
  items: Array<{
    itemId: string
    itemName: string
    basePrice: string
    priceLevelPrices: PriceLevelPrice[]
  }>,
  activeDaypartId: string | null,
  activeDaypartName: string | null,
): Array<{ itemId: string; itemName: string } & ResolvedPrice> {
  return items.map((item) => {
    const resolved = resolvePrice({
      basePrice: item.basePrice,
      priceLevelPrices: item.priceLevelPrices,
      activeDaypartId,
      activeDaypartName,
      manualOverride: null,
      promotion: null,
    })
    return {
      itemId: item.itemId,
      itemName: item.itemName,
      ...resolved,
    }
  })
}

// ---------------------------------------------------------------------------
// Price level constants
// ---------------------------------------------------------------------------

export const PRICE_LEVEL_NAMES = [
  'Regular',
  'Happy Hour',
  'Employee',
  'Early Bird',
  'Late Night',
  'Kids',
  'Catering',
  'Online',
  'Custom',
] as const

export type PriceLevelName = (typeof PRICE_LEVEL_NAMES)[number]

export const PRICE_TYPES = [
  { value: 'fixed', label: 'Fixed Price' },
  { value: 'market_price', label: 'Market Price' },
  { value: 'open', label: 'Open Price' },
  { value: 'weight_based', label: 'Weight-Based' },
  { value: 'size_based', label: 'Size-Based' },
] as const

export type PriceType = (typeof PRICE_TYPES)[number]['value']

export const AVAILABILITY_TYPES = [
  { value: 'always', label: 'Always Available' },
  { value: 'specific_dayparts', label: 'Specific Dayparts' },
  { value: 'specific_days', label: 'Specific Days' },
  { value: 'date_range', label: 'Date Range' },
  { value: 'until_86d', label: "Until 86'd" },
  { value: 'quantity_limited', label: 'Quantity Limited' },
] as const

export type AvailabilityType = (typeof AVAILABILITY_TYPES)[number]['value']

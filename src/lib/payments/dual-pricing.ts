/**
 * Dual Pricing Engine
 *
 * Implements Valor PayTech's Dual Pricing model:
 * - Cash price = base menu price (no surcharge)
 * - Card price = base menu price + surcharge (default 4%)
 *
 * Structured as a "cash discount" (not card surcharge) for legal
 * compliance in all 50 US states. Under the Durbin Amendment,
 * cash discounts can apply to both credit AND debit cards.
 *
 * All amounts are in integer cents to avoid floating-point errors.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DualPriceResult {
  /** Price when paying by card (base + surcharge) */
  card_price_cents: number
  /** Price when paying by cash (base price, the "discount") */
  cash_price_cents: number
  /** The surcharge amount in cents */
  surcharge_cents: number
  /** Human-readable savings message */
  savings_message: string
  /** Whether dual pricing is active */
  is_active: boolean
}

export interface DualPricingConfig {
  /** Whether dual pricing is enabled for this location */
  is_enabled: boolean
  /** Surcharge rate as percentage (e.g., 4.0 means 4%) */
  rate_percent: number
  /** How to label it: 'cash_discount' or 'card_surcharge' */
  display_mode: 'cash_discount' | 'card_surcharge'
}

/** Default surcharge rate: 4% */
const DEFAULT_RATE_PERCENT = 4.0

// ---------------------------------------------------------------------------
// Core calculation
// ---------------------------------------------------------------------------

/**
 * Calculate dual prices for a given subtotal.
 *
 * Menu prices in Sear are the CARD price (the higher price).
 * Cash price = card price / (1 + rate).
 *
 * This is the Valor model: the posted menu price IS the card price,
 * and paying cash gives you a discount.
 *
 * @param subtotal_cents  The subtotal in cents (this IS the card price)
 * @param config          Dual pricing configuration (optional, uses defaults)
 */
export function calculateDualPrices(
  subtotal_cents: number,
  config?: Partial<DualPricingConfig>
): DualPriceResult {
  const isEnabled = config?.is_enabled ?? false
  const ratePercent = config?.rate_percent ?? DEFAULT_RATE_PERCENT

  if (!isEnabled || ratePercent <= 0) {
    return {
      card_price_cents: subtotal_cents,
      cash_price_cents: subtotal_cents,
      surcharge_cents: 0,
      savings_message: '',
      is_active: false,
    }
  }

  // Card price = menu price (what's posted)
  const cardPriceCents = subtotal_cents

  // Cash price = card price / (1 + rate)
  // This ensures the surcharge is exactly rate% of the cash price
  const cashPriceCents = Math.round(cardPriceCents / (1 + ratePercent / 100))
  const surchargeCents = cardPriceCents - cashPriceCents

  return {
    card_price_cents: cardPriceCents,
    cash_price_cents: cashPriceCents,
    surcharge_cents: surchargeCents,
    savings_message: formatSavingsMessage(surchargeCents),
    is_active: true,
  }
}

/**
 * Calculate dual prices for a single menu item price.
 * Convenience wrapper for item-level display.
 */
export function calculateItemDualPrices(
  item_price_cents: number,
  quantity: number,
  ratePercent: number = DEFAULT_RATE_PERCENT
): { card_unit_cents: number; cash_unit_cents: number; card_total_cents: number; cash_total_cents: number } {
  const cardUnitCents = item_price_cents
  const cashUnitCents = Math.round(item_price_cents / (1 + ratePercent / 100))

  return {
    card_unit_cents: cardUnitCents,
    cash_unit_cents: cashUnitCents,
    card_total_cents: cardUnitCents * quantity,
    cash_total_cents: cashUnitCents * quantity,
  }
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format cents to a dollar string: 1234 -> "$12.34"
 */
export function formatCentsToDollars(cents: number): string {
  const isNegative = cents < 0
  const absCents = Math.abs(cents)
  const dollars = Math.floor(absCents / 100)
  const remainder = absCents % 100
  const formatted = `$${dollars.toLocaleString()}.${String(remainder).padStart(2, '0')}`
  return isNegative ? `-${formatted}` : formatted
}

function formatSavingsMessage(savingsCents: number): string {
  if (savingsCents <= 0) return ''
  return `Save ${formatCentsToDollars(savingsCents)} with cash`
}

/**
 * Format a dual price display for receipts.
 * Example: "Card: $16.00 | Cash: $15.38"
 */
export function formatDualPriceDisplay(
  cardCents: number,
  cashCents: number
): string {
  return `Card: ${formatCentsToDollars(cardCents)} | Cash: ${formatCentsToDollars(cashCents)}`
}

/**
 * Calculate change denomination breakdown.
 * Returns the optimal denominations to make change.
 */
export function calculateChangeDenominations(changeCents: number): Array<{
  label: string
  count: number
  value_cents: number
}> {
  if (changeCents <= 0) return []

  const denominations = [
    { label: '$100', value_cents: 10000 },
    { label: '$50', value_cents: 5000 },
    { label: '$20', value_cents: 2000 },
    { label: '$10', value_cents: 1000 },
    { label: '$5', value_cents: 500 },
    { label: '$1', value_cents: 100 },
    { label: 'quarter', value_cents: 25 },
    { label: 'dime', value_cents: 10 },
    { label: 'nickel', value_cents: 5 },
    { label: 'penny', value_cents: 1 },
  ]

  const result: Array<{ label: string; count: number; value_cents: number }> = []
  let remaining = changeCents

  for (const denom of denominations) {
    if (remaining >= denom.value_cents) {
      const count = Math.floor(remaining / denom.value_cents)
      result.push({ label: denom.label, count, value_cents: denom.value_cents })
      remaining -= count * denom.value_cents
    }
  }

  return result
}

/**
 * Format change denomination breakdown as a human-readable string.
 * Example: "1x$10, 1x$5, 3x$1, 1x quarter"
 */
export function formatChangeDenominations(changeCents: number): string {
  const denominations = calculateChangeDenominations(changeCents)
  if (denominations.length === 0) return 'No change'

  return denominations
    .map((d) => {
      const plural = d.count > 1 && ['quarter', 'dime', 'nickel', 'penny'].includes(d.label)
      const label = plural
        ? d.label === 'penny' ? 'pennies' : `${d.label}s`
        : d.label
      return `${d.count}x ${label}`
    })
    .join(', ')
}

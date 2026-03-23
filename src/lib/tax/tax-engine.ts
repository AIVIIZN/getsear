/**
 * Tax Engine — replaces all hardcoded 8.5% tax calculations.
 *
 * Each menu item has a tax_class (via the tax_rate's applies_to field):
 *   'food', 'alcohol', 'non_taxable', 'retail'
 *
 * Each location has multiple tax rates that stack (state + county + city).
 * Tax rates specify which classes they apply to via the applies_to text[] column.
 *
 * For Here vs To Go can affect which rates apply (some jurisdictions exempt
 * takeout food from sales tax). This is controlled by a takeout_exempt flag
 * in the tax rate's applies_to array — if a rate's applies_to contains
 * 'dine_in_only', it is skipped for to-go orders.
 *
 * All math uses integer cents to avoid floating-point rounding errors.
 */

/** A tax rate row from the tax_rates table */
export interface TaxRate {
  id: string
  name: string
  /** Decimal rate, e.g. 0.0825 for 8.25% */
  rate: number
  is_inclusive: boolean
  /** Which item classes this rate applies to. Empty array = all items. */
  applies_to: string[]
  is_default: boolean
  is_active: boolean
}

/** An item to be taxed (matches order_item shape) */
export interface TaxableItem {
  /** Taxable amount in cents (line_total minus comps/discounts, before tax) */
  taxable_amount_cents: number
  /** The tax class of this item, derived from the menu item's tax_rate assignment */
  tax_class: string
  /** Whether this item is taxable at all */
  is_taxable: boolean
}

/** Breakdown of tax by rate */
export interface TaxBreakdownEntry {
  tax_rate_id: string
  tax_rate_name: string
  rate: number
  taxable_amount_cents: number
  tax_amount_cents: number
}

/** Result of tax calculation */
export interface TaxCalculationResult {
  /** Total tax in cents */
  total_tax_cents: number
  /** Breakdown by individual tax rate */
  breakdown: TaxBreakdownEntry[]
}

/**
 * Determines whether a tax rate applies to a given item class and order context.
 *
 * Rules:
 * - If applies_to is empty or not set, the rate applies to ALL taxable items.
 * - If applies_to contains the item's tax_class, it applies.
 * - If applies_to contains 'dine_in_only' and the order is to-go, skip this rate.
 */
function rateAppliesToItem(
  rate: TaxRate,
  taxClass: string,
  isForHere: boolean
): boolean {
  const appliesTo = rate.applies_to ?? []

  // Check dine_in_only restriction
  if (appliesTo.includes('dine_in_only') && !isForHere) {
    return false
  }

  // Filter out control flags to get actual class names
  const classFilters = appliesTo.filter((a) => a !== 'dine_in_only')

  // Empty class list means applies to all items
  if (classFilters.length === 0) {
    return true
  }

  return classFilters.includes(taxClass)
}

/**
 * Calculate tax for a single item against all applicable tax rates.
 * Tax rates stack — state + county + city each calculated independently on the same base.
 *
 * @param item - The taxable item
 * @param taxRates - All active tax rates for the location
 * @param isForHere - Whether the order is for-here (vs to-go)
 * @returns Tax amount in integer cents
 */
export function calculateItemTax(
  item: TaxableItem,
  taxRates: TaxRate[],
  isForHere: boolean
): TaxCalculationResult {
  if (!item.is_taxable || item.taxable_amount_cents <= 0) {
    return { total_tax_cents: 0, breakdown: [] }
  }

  const breakdown: TaxBreakdownEntry[] = []
  let totalTaxCents = 0

  for (const rate of taxRates) {
    if (!rate.is_active) continue
    if (!rateAppliesToItem(rate, item.tax_class, isForHere)) continue

    let taxCents: number

    if (rate.is_inclusive) {
      // VAT-style: tax is already included in the price
      // tax = price - (price / (1 + rate))
      // In cents: tax = amount - round(amount / (1 + rate))
      const preTaxCents = Math.round(item.taxable_amount_cents / (1 + rate.rate))
      taxCents = item.taxable_amount_cents - preTaxCents
    } else {
      // Standard: tax is added on top of the price
      taxCents = Math.round(item.taxable_amount_cents * rate.rate)
    }

    if (taxCents > 0) {
      breakdown.push({
        tax_rate_id: rate.id,
        tax_rate_name: rate.name,
        rate: rate.rate,
        taxable_amount_cents: item.taxable_amount_cents,
        tax_amount_cents: taxCents,
      })
      totalTaxCents += taxCents
    }
  }

  return { total_tax_cents: totalTaxCents, breakdown }
}

/**
 * Calculate tax for an entire order (all items).
 * Returns total tax and a breakdown by tax rate.
 *
 * @param items - All taxable items on the order
 * @param taxRates - All active tax rates for the location
 * @param isForHere - Whether the order is for-here (vs to-go)
 * @returns Aggregated tax calculation result
 */
export function calculateOrderTax(
  items: TaxableItem[],
  taxRates: TaxRate[],
  isForHere: boolean
): TaxCalculationResult {
  const aggregated = new Map<string, TaxBreakdownEntry>()
  let totalTaxCents = 0

  for (const item of items) {
    const result = calculateItemTax(item, taxRates, isForHere)
    totalTaxCents += result.total_tax_cents

    for (const entry of result.breakdown) {
      const existing = aggregated.get(entry.tax_rate_id)
      if (existing) {
        existing.taxable_amount_cents += entry.taxable_amount_cents
        existing.tax_amount_cents += entry.tax_amount_cents
      } else {
        aggregated.set(entry.tax_rate_id, { ...entry })
      }
    }
  }

  return {
    total_tax_cents: totalTaxCents,
    breakdown: Array.from(aggregated.values()),
  }
}

/**
 * Convert a dollar string (from DB numeric(10,2)) to integer cents.
 */
export function dollarsToCents(dollars: string | number): number {
  const num = typeof dollars === 'string' ? parseFloat(dollars) : dollars
  return Math.round(num * 100)
}

/**
 * Convert integer cents to a dollar string for DB storage.
 */
export function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2)
}

/**
 * Parse a rate string from DB (e.g., "0.0825") to a number.
 */
export function parseRate(rate: string | number): number {
  return typeof rate === 'string' ? parseFloat(rate) : rate
}

/**
 * Build TaxRate objects from raw DB rows, normalizing types.
 */
export function normalizeTaxRates(
  rows: Array<{
    id: string
    name: string
    rate: string | number
    is_inclusive: boolean
    applies_to: string[] | null
    is_default: boolean
    is_active: boolean
  }>
): TaxRate[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    rate: parseRate(row.rate),
    is_inclusive: row.is_inclusive,
    applies_to: row.applies_to ?? [],
    is_default: row.is_default,
    is_active: row.is_active,
  }))
}

/**
 * Determine the tax class for a menu item.
 * Falls back to 'food' if no explicit class is set.
 * If the item is not taxable, returns 'non_taxable'.
 */
export function getItemTaxClass(menuItem: {
  is_taxable?: boolean
  tax_class?: string | null
  course?: string | null
}): string {
  if (menuItem.is_taxable === false) {
    return 'non_taxable'
  }

  if (menuItem.tax_class) {
    return menuItem.tax_class
  }

  // Infer from course if no explicit tax class
  if (menuItem.course === 'drink') {
    return 'alcohol'
  }

  return 'food'
}

/**
 * Determine if an order is "for here" based on order type and explicit flag.
 * Dine-in and bar orders default to for-here.
 * Takeout, delivery, online, drive_thru default to to-go.
 */
export function isOrderForHere(
  orderType: string,
  forHereFlag?: boolean | null
): boolean {
  // Explicit flag takes precedence
  if (forHereFlag !== undefined && forHereFlag !== null) {
    return forHereFlag
  }

  // Default based on order type
  switch (orderType) {
    case 'dine_in':
    case 'bar':
      return true
    case 'takeout':
    case 'delivery':
    case 'online':
    case 'drive_thru':
      return false
    default:
      // Catering, kiosk, qr — default to for-here
      return true
  }
}

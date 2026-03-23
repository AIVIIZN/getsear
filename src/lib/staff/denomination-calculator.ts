/**
 * Denomination Calculator
 *
 * US currency denominations for cash drawer counting.
 * Provides denomination breakdown, running totals, and over/short calculation.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Denomination {
  key: string
  label: string
  valueCents: number
  type: 'bill' | 'coin'
  /** Default sort order */
  sortOrder: number
}

export interface DenominationCount {
  key: string
  quantity: number
}

export interface DenominationBreakdown {
  key: string
  label: string
  valueCents: number
  quantity: number
  subtotalCents: number
}

export interface CashCount {
  denominations: DenominationBreakdown[]
  totalCents: number
}

export interface OverShortResult {
  expectedCents: number
  actualCents: number
  differenceCents: number
  /** Positive = over, negative = short */
  isOver: boolean
  isShort: boolean
  isEven: boolean
  /** Whether the discrepancy exceeds the threshold (default $5) */
  requiresManagerReview: boolean
  formattedDifference: string
}

// ---------------------------------------------------------------------------
// US Currency Denominations
// ---------------------------------------------------------------------------

export const US_DENOMINATIONS: Denomination[] = [
  { key: 'hundred', label: '$100', valueCents: 10000, type: 'bill', sortOrder: 0 },
  { key: 'fifty', label: '$50', valueCents: 5000, type: 'bill', sortOrder: 1 },
  { key: 'twenty', label: '$20', valueCents: 2000, type: 'bill', sortOrder: 2 },
  { key: 'ten', label: '$10', valueCents: 1000, type: 'bill', sortOrder: 3 },
  { key: 'five', label: '$5', valueCents: 500, type: 'bill', sortOrder: 4 },
  { key: 'one', label: '$1', valueCents: 100, type: 'bill', sortOrder: 5 },
  { key: 'quarter', label: 'Quarters', valueCents: 25, type: 'coin', sortOrder: 6 },
  { key: 'dime', label: 'Dimes', valueCents: 10, type: 'coin', sortOrder: 7 },
  { key: 'nickel', label: 'Nickels', valueCents: 5, type: 'coin', sortOrder: 8 },
  { key: 'penny', label: 'Pennies', valueCents: 1, type: 'coin', sortOrder: 9 },
]

// ---------------------------------------------------------------------------
// Calculate denomination count
// ---------------------------------------------------------------------------

export function calculateCashCount(counts: DenominationCount[]): CashCount {
  const countMap = new Map(counts.map((c) => [c.key, c.quantity]))

  const denominations: DenominationBreakdown[] = US_DENOMINATIONS.map((denom) => {
    const quantity = countMap.get(denom.key) ?? 0
    return {
      key: denom.key,
      label: denom.label,
      valueCents: denom.valueCents,
      quantity,
      subtotalCents: quantity * denom.valueCents,
    }
  })

  const totalCents = denominations.reduce((s, d) => s + d.subtotalCents, 0)

  return { denominations, totalCents }
}

// ---------------------------------------------------------------------------
// Calculate over/short
// ---------------------------------------------------------------------------

export function calculateOverShort(
  expectedCents: number,
  actualCents: number,
  thresholdCents: number = 500 // $5.00 default
): OverShortResult {
  const differenceCents = actualCents - expectedCents
  const absDiff = Math.abs(differenceCents)

  return {
    expectedCents,
    actualCents,
    differenceCents,
    isOver: differenceCents > 0,
    isShort: differenceCents < 0,
    isEven: differenceCents === 0,
    requiresManagerReview: absDiff > thresholdCents,
    formattedDifference:
      differenceCents === 0
        ? 'Even'
        : `${differenceCents > 0 ? '+' : '-'}$${(absDiff / 100).toFixed(2)}`,
  }
}

// ---------------------------------------------------------------------------
// Optimal denomination breakdown for a given amount
// ---------------------------------------------------------------------------

/**
 * Given a dollar amount in cents, calculate the optimal denomination breakdown
 * (fewest bills/coins). Useful for "cash owed" display in server checkout.
 */
export function optimalDenominations(amountCents: number): DenominationBreakdown[] {
  let remaining = Math.abs(Math.round(amountCents))

  return US_DENOMINATIONS.map((denom) => {
    const quantity = Math.floor(remaining / denom.valueCents)
    remaining -= quantity * denom.valueCents
    return {
      key: denom.key,
      label: denom.label,
      valueCents: denom.valueCents,
      quantity,
      subtotalCents: quantity * denom.valueCents,
    }
  }).filter((d) => d.quantity > 0)
}

// ---------------------------------------------------------------------------
// Empty denomination counts (for initializing the counter)
// ---------------------------------------------------------------------------

export function emptyDenominationCounts(): DenominationCount[] {
  return US_DENOMINATIONS.map((d) => ({ key: d.key, quantity: 0 }))
}

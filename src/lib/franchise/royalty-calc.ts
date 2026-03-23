/**
 * Royalty calculation utilities for franchise module.
 */

export type RoyaltyType = 'percentage' | 'flat' | 'tiered'

export interface RoyaltyTerms {
  type: RoyaltyType
  percentage: number // 0-100 for percentage type
  flat_amount: number // cents for flat type
  tiers: Array<{
    min_sales: number // cents
    max_sales: number | null // cents, null = unlimited
    percentage: number
  }>
}

export interface RoyaltyResult {
  location_id: string
  location_name: string
  gross_sales: number // cents
  royalty_amount: number // cents
  royalty_type: RoyaltyType
  effective_rate: number // percentage
  period: string
}

/**
 * Calculate royalty for a single location.
 */
export function calculateRoyalty(
  grossSales: number,
  terms: RoyaltyTerms
): number {
  switch (terms.type) {
    case 'percentage':
      return Math.round(grossSales * (terms.percentage / 100))

    case 'flat':
      return terms.flat_amount

    case 'tiered': {
      let remaining = grossSales
      let royalty = 0

      const sortedTiers = [...terms.tiers].sort((a, b) => a.min_sales - b.min_sales)

      for (const tier of sortedTiers) {
        if (remaining <= 0) break

        const tierMax = tier.max_sales !== null ? tier.max_sales - tier.min_sales : remaining
        const taxableInTier = Math.min(remaining, tierMax)
        royalty += Math.round(taxableInTier * (tier.percentage / 100))
        remaining -= taxableInTier
      }

      return royalty
    }

    default:
      return 0
  }
}

/**
 * Calculate royalties for multiple locations.
 */
export function calculateRoyaltiesForPeriod(
  locations: Array<{
    id: string
    name: string
    gross_sales: number
    terms: RoyaltyTerms
  }>,
  period: string
): {
  results: RoyaltyResult[]
  total_royalties: number
  total_gross_sales: number
} {
  const results: RoyaltyResult[] = locations.map((loc) => {
    const royaltyAmount = calculateRoyalty(loc.gross_sales, loc.terms)
    const effectiveRate = loc.gross_sales > 0
      ? Math.round((royaltyAmount / loc.gross_sales) * 10000) / 100
      : 0

    return {
      location_id: loc.id,
      location_name: loc.name,
      gross_sales: loc.gross_sales,
      royalty_amount: royaltyAmount,
      royalty_type: loc.terms.type,
      effective_rate: effectiveRate,
      period,
    }
  })

  return {
    results,
    total_royalties: results.reduce((sum, r) => sum + r.royalty_amount, 0),
    total_gross_sales: results.reduce((sum, r) => sum + r.gross_sales, 0),
  }
}

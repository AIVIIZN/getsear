import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'
import {
  calculateOrderTax,
  isOrderForHere,
  dollarsToCents,
  centsToDollars,
  type TaxableItem,
} from '@/lib/tax/tax-engine'
import { fetchLocationTaxRates } from '@/lib/tax/recalculate-order'

const taxItemSchema = z.object({
  /** Amount in dollars (e.g. "12.50") */
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  /** Tax class: food, alcohol, non_taxable, retail */
  tax_class: z.string().min(1).max(50).default('food'),
  /** Whether this item is taxable */
  is_taxable: z.boolean().default(true),
})

const calculateTaxSchema = z.object({
  location_id: z.string().uuid(),
  order_type: z.string().min(1).max(50).default('dine_in'),
  /** Explicit for-here / to-go flag */
  for_here: z.boolean().optional(),
  items: z.array(taxItemSchema).min(1).max(500),
})

/**
 * POST /api/tax/calculate
 *
 * Real-time tax calculation endpoint used by the POS for preview.
 * Accepts items with amounts and tax classes, returns tax breakdown.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = calculateTaxSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { location_id, order_type, for_here, items } = parsed.data

  const supabase = createAdminClient()

  // Fetch tax rates for this location
  const taxRates = await fetchLocationTaxRates(supabase, user.org_id, location_id)

  // Build taxable items (convert dollar amounts to cents)
  const taxableItems: TaxableItem[] = items.map((item) => ({
    taxable_amount_cents: dollarsToCents(item.amount),
    tax_class: item.tax_class,
    is_taxable: item.is_taxable,
  }))

  const isForHere = isOrderForHere(order_type, for_here ?? null)
  const result = calculateOrderTax(taxableItems, taxRates, isForHere)

  // Convert cents back to dollars for the response
  const subtotalCents = taxableItems.reduce((sum, i) => sum + i.taxable_amount_cents, 0)

  return NextResponse.json({
    data: {
      subtotal: centsToDollars(subtotalCents),
      tax_total: centsToDollars(result.total_tax_cents),
      total: centsToDollars(subtotalCents + result.total_tax_cents),
      is_for_here: isForHere,
      breakdown: result.breakdown.map((entry) => ({
        tax_rate_id: entry.tax_rate_id,
        tax_rate_name: entry.tax_rate_name,
        rate: entry.rate,
        taxable_amount: centsToDollars(entry.taxable_amount_cents),
        tax_amount: centsToDollars(entry.tax_amount_cents),
      })),
      tax_rates_applied: taxRates.length,
    },
  })
}

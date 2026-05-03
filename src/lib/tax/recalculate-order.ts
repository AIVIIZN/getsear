/**
 * Shared utility for recalculating order totals using the tax engine.
 * Used by all API routes that modify order items, discounts, or comps.
 */

import {
  calculateItemTax,
  calculateOrderTax,
  dollarsToCents,
  centsToDollars,
  normalizeTaxRates,
  isOrderForHere,
  type TaxableItem,
  type TaxRate,
} from '@/lib/tax/tax-engine'

/**
 * Fetch active tax rates for a location from the database.
 */
export async function fetchLocationTaxRates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orgId: string,
  locationId: string
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rates } = await (supabase.from('tax_rates') as any)
    .select('id, name, rate, is_inclusive, applies_to, is_default, is_active')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .or(`location_id.eq.${locationId},location_id.is.null`)

  return normalizeTaxRates(rates ?? [])
}

/**
 * Recalculate all order totals using the real tax engine.
 * Replaces the old hardcoded 8.5% calculation.
 *
 * This function:
 * 1. Fetches all non-voided order items
 * 2. Fetches the order's location and type
 * 3. Fetches tax rates for that location
 * 4. Calculates tax per item using the tax engine
 * 5. Updates per-item tax_amount fields
 * 6. Sums everything and updates the order totals
 */
export async function recalculateOrderTotals(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orderId: string,
  orgId: string
): Promise<void> {
  // Get order metadata (location, type, for_here flag)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (supabase.from('orders') as any)
    .select('location_id, order_type, amount_paid, metadata')
    .eq('id', orderId)
    .single()

  if (!order) return

  const forHere = isOrderForHere(
    order.order_type,
    order.metadata?.for_here ?? null
  )

  // Fetch tax rates for this location
  const taxRates = await fetchLocationTaxRates(supabase, orgId, order.location_id)

  // Fetch all order items with their menu item tax info
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: items } = await (supabase.from('order_items') as any)
    .select('id, line_total, is_voided, is_comped, comp_amount, menu_item_id, discount_amount')
    .eq('order_id', orderId)

  if (!items) return

  // For each item, look up the menu item's tax class if available
  // Build a map of menu_item_id -> tax_class
  const menuItemIds = items
    .filter((i: Record<string, unknown>) => i.menu_item_id && !i.is_voided)
    .map((i: Record<string, unknown>) => i.menu_item_id as string)

  const menuItemTaxClasses: Record<string, { is_taxable: boolean; tax_class: string }> = {}

  if (menuItemIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: menuItems } = await (supabase.from('menu_items') as any)
      .select('id, is_taxable, course')
      .in('id', menuItemIds)

    if (menuItems) {
      for (const mi of menuItems) {
        // Determine tax class from course or default to 'food'
        let taxClass = 'food'
        if (!mi.is_taxable) {
          taxClass = 'non_taxable'
        } else if (mi.course === 'drink') {
          taxClass = 'alcohol'
        }
        menuItemTaxClasses[mi.id] = {
          is_taxable: mi.is_taxable ?? true,
          tax_class: taxClass,
        }
      }
    }
  }

  // Build taxable items and calculate tax
  let subtotalCents = 0
  const taxableItems: Array<TaxableItem & { item_id: string }> = []

  for (const item of items) {
    if (item.is_voided) continue

    const lineTotalCents = dollarsToCents(item.line_total || '0')
    const compAmountCents = dollarsToCents(item.comp_amount || '0')
    const discountAmountCents = dollarsToCents(item.discount_amount || '0')
    const taxableAmountCents = lineTotalCents - compAmountCents - discountAmountCents

    subtotalCents += lineTotalCents - compAmountCents

    const taxInfo = item.menu_item_id
      ? menuItemTaxClasses[item.menu_item_id] ?? { is_taxable: true, tax_class: 'food' }
      : { is_taxable: true, tax_class: 'food' }

    taxableItems.push({
      item_id: item.id,
      taxable_amount_cents: Math.max(0, taxableAmountCents),
      tax_class: taxInfo.tax_class,
      is_taxable: taxInfo.is_taxable,
    })
  }

  // Calculate tax using the engine
  const taxResult = calculateOrderTax(taxableItems, taxRates, forHere)

  // Update per-item tax amounts
  // Calculate per-item tax for DB storage
  for (const item of items) {
    if (item.is_voided) continue
    const taxableItem = taxableItems.find((ti) => ti.item_id === item.id)
    if (!taxableItem) continue

    const itemTax = calculateItemTaxForSingle(taxableItem, taxRates, forHere)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('order_items') as any)
      .update({ tax_amount: centsToDollars(itemTax) })
      .eq('id', item.id)
  }

  // Get order-level discounts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: discounts } = await (supabase.from('order_discounts') as any)
    .select('applied_amount')
    .eq('order_id', orderId)
    .is('order_item_id', null)

  const discountTotalCents = (discounts ?? []).reduce(
    (sum: number, d: { applied_amount: string }) =>
      sum + dollarsToCents(d.applied_amount || '0'),
    0
  )

  // Adjust subtotal for order-level discounts
  const adjustedSubtotalCents = subtotalCents - discountTotalCents
  const totalCents = adjustedSubtotalCents + taxResult.total_tax_cents

  const amountPaidCents = dollarsToCents(order.amount_paid ?? '0')
  const balanceDueCents = Math.max(0, totalCents - amountPaidCents)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('orders') as any)
    .update({
      subtotal: centsToDollars(subtotalCents),
      discount_total: centsToDollars(discountTotalCents),
      tax_total: centsToDollars(taxResult.total_tax_cents),
      total: centsToDollars(totalCents),
      balance_due: centsToDollars(balanceDueCents),
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
}

/**
 * Helper: calculate tax for a single taxable item (returns cents).
 */
function calculateItemTaxForSingle(
  item: TaxableItem,
  taxRates: TaxRate[],
  isForHere: boolean
): number {
  const result = calculateItemTax(item, taxRates, isForHere)
  return result.total_tax_cents
}

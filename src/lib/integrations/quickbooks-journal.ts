/**
 * QuickBooks Journal Entry Builder
 *
 * Creates journal entries from Sear POS daily sales data.
 * Maps Sear revenue categories to QBO accounts.
 * Idempotent: re-sync updates existing entry, not duplicate.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { qboApiRequest, getQboConnection } from './quickbooks-client'

export const SEAR_CATEGORIES = [
  { key: 'food_sales', label: 'Food Sales', required: true },
  { key: 'beverage_sales', label: 'Beverage Sales', required: true },
  { key: 'retail_sales', label: 'Retail Sales', required: false },
  { key: 'online_orders', label: 'Online Orders', required: false },
  { key: 'catering', label: 'Catering', required: false },
  { key: 'gift_card_sales', label: 'Gift Card Sales', required: false },
  { key: 'tips', label: 'Tips', required: true },
  { key: 'sales_tax', label: 'Sales Tax', required: true },
  { key: 'refunds', label: 'Refunds (Contra-Revenue)', required: false },
  { key: 'bank_deposit', label: 'Bank/Clearing Account', required: true },
] as const

export type SearCategoryKey = typeof SEAR_CATEGORIES[number]['key']

export interface AccountMapping {
  sear_category: SearCategoryKey
  qbo_account_id: string
  qbo_account_name: string
}

export interface DailySalesData {
  businessDate: string
  locationId: string
  food_sales: number // cents
  beverage_sales: number // cents
  retail_sales: number
  online_orders: number
  catering: number
  gift_card_sales: number
  tips: number
  sales_tax: number
  refunds: number
  total_deposit: number // net amount (food + bev + retail + online + catering + gift - refunds + tax)
}

/**
 * Get account mappings for a location.
 */
export async function getAccountMappings(locationId: string): Promise<AccountMapping[]> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from('qbo_account_mappings') as any)
    .select('sear_category, qbo_account_id, qbo_account_name')
    .eq('location_id', locationId)

  return data ?? []
}

/**
 * Save account mappings for a location.
 */
export async function saveAccountMappings(
  locationId: string,
  mappings: AccountMapping[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient()

  // Delete existing mappings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('qbo_account_mappings') as any)
    .delete()
    .eq('location_id', locationId)

  // Insert new mappings
  const rows = mappings.map(m => ({
    location_id: locationId,
    ...m,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('qbo_account_mappings') as any)
    .insert(rows)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

/**
 * Validate that required mappings exist before syncing.
 */
export function validateMappings(mappings: AccountMapping[]): { valid: boolean; missing: string[] } {
  const requiredKeys = SEAR_CATEGORIES.filter(c => c.required).map(c => c.key)
  const mappedKeys = new Set(mappings.map(m => m.sear_category))
  const missing = requiredKeys.filter(k => !mappedKeys.has(k))
  return { valid: missing.length === 0, missing }
}

/**
 * Fetch daily sales totals for a business date.
 */
export async function getDailySalesData(
  locationId: string,
  businessDate: string
): Promise<DailySalesData | null> {
  const supabase = createAdminClient()

  // Get daily totals from orders
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orders } = await (supabase.from('orders') as any)
    .select('id, order_type, subtotal, tax_total, tip_amount, total, status')
    .eq('location_id', locationId)
    .eq('business_date', businessDate)
    .in('status', ['closed', 'completed'])

  if (!orders || orders.length === 0) return null

  let foodSales = 0
  const beverageSales = 0
  const retailSales = 0
  let onlineOrders = 0
  let cateringSales = 0
  const giftCardSales = 0
  let tips = 0
  let salesTax = 0
  let refunds = 0

  for (const order of orders) {
    const subtotal = Math.round(Number(order.subtotal ?? 0) * 100)
    const tax = Math.round(Number(order.tax_total ?? 0) * 100)
    const tip = Math.round(Number(order.tip_amount ?? 0) * 100)

    tips += tip
    salesTax += tax

    // Categorize by order type
    switch (order.order_type) {
      case 'online':
        onlineOrders += subtotal
        break
      case 'catering':
        cateringSales += subtotal
        break
      default:
        // Default to food sales — in production would look at item categories
        foodSales += subtotal
        break
    }
  }

  // Get refunds
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: refundData } = await (supabase.from('payments') as any)
    .select('amount')
    .eq('location_id', locationId)
    .eq('business_date', businessDate)
    .eq('type', 'refund')

  for (const r of (refundData ?? [])) {
    refunds += Math.round(Number(r.amount ?? 0) * 100)
  }

  const totalDeposit = foodSales + beverageSales + retailSales + onlineOrders +
    cateringSales + giftCardSales + salesTax - refunds

  return {
    businessDate,
    locationId,
    food_sales: foodSales,
    beverage_sales: beverageSales,
    retail_sales: retailSales,
    online_orders: onlineOrders,
    catering: cateringSales,
    gift_card_sales: giftCardSales,
    tips,
    sales_tax: salesTax,
    refunds,
    total_deposit: totalDeposit,
  }
}

/**
 * Build and submit a QBO journal entry for a business date.
 * Idempotent: uses business_date + location_id as unique key.
 */
export async function syncDailySales(
  locationId: string,
  businessDate: string
): Promise<{ success: boolean; journalEntryId?: string; totalSynced?: number; error?: string }> {
  // 1. Get connection
  const connection = await getQboConnection(locationId)
  if (!connection || !connection.is_active) {
    return { success: false, error: 'QuickBooks not connected' }
  }

  // 2. Get mappings
  const mappings = await getAccountMappings(locationId)
  const validation = validateMappings(mappings)
  if (!validation.valid) {
    return { success: false, error: `Missing required mappings: ${validation.missing.join(', ')}` }
  }

  // 3. Get sales data
  const salesData = await getDailySalesData(locationId, businessDate)
  if (!salesData) {
    return { success: false, error: 'No sales data for this date' }
  }

  // 4. Build journal entry
  const mappingMap = new Map(mappings.map(m => [m.sear_category, m]))
  const lines: Array<{ Description: string; Amount: number; DetailType: string; JournalEntryLineDetail: unknown }> = []

  const addLine = (category: SearCategoryKey, amount: number, isDebit: boolean, label: string) => {
    if (amount === 0) return
    const mapping = mappingMap.get(category)
    if (!mapping) return

    lines.push({
      Description: `${label} — ${businessDate}`,
      Amount: amount / 100, // QBO uses dollars
      DetailType: 'JournalEntryLineDetail',
      JournalEntryLineDetail: {
        PostingType: isDebit ? 'Debit' : 'Credit',
        AccountRef: {
          value: mapping.qbo_account_id,
          name: mapping.qbo_account_name,
        },
      },
    })
  }

  // Credits (revenue accounts)
  addLine('food_sales', salesData.food_sales, false, 'Food Sales')
  addLine('beverage_sales', salesData.beverage_sales, false, 'Beverage Sales')
  addLine('retail_sales', salesData.retail_sales, false, 'Retail Sales')
  addLine('online_orders', salesData.online_orders, false, 'Online Orders')
  addLine('catering', salesData.catering, false, 'Catering')
  addLine('gift_card_sales', salesData.gift_card_sales, false, 'Gift Card Sales')
  addLine('sales_tax', salesData.sales_tax, false, 'Sales Tax Collected')
  addLine('tips', salesData.tips, false, 'Tips Payable')

  // Debit (contra-revenue for refunds)
  addLine('refunds', salesData.refunds, true, 'Refunds')

  // Debit (bank/clearing account — net deposit)
  addLine('bank_deposit', salesData.total_deposit, true, 'Daily Deposit')

  if (lines.length === 0) {
    return { success: false, error: 'No revenue data to sync' }
  }

  const journalEntry = {
    DocNumber: `SEAR-${businessDate}-${locationId.slice(0, 8)}`,
    TxnDate: businessDate,
    PrivateNote: `Sear POS daily sales — ${businessDate}`,
    Line: lines,
  }

  // 5. Check for existing entry (idempotency)
  const supabase = createAdminClient()
  const idempotencyKey = `${businessDate}:${locationId}`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingLog } = await (supabase.from('qbo_sync_log') as any)
    .select('id, qbo_journal_entry_id')
    .eq('location_id', locationId)
    .eq('business_date', businessDate)
    .eq('status', 'success')
    .maybeSingle()

  let result
  if (existingLog?.qbo_journal_entry_id) {
    // Update existing journal entry
    // First fetch the existing entry to get its SyncToken
    const existingResult = await qboApiRequest(
      locationId,
      'GET',
      `/journalentry/${existingLog.qbo_journal_entry_id}`
    )

    if (existingResult.success && existingResult.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = (existingResult.data as any).JournalEntry
      result = await qboApiRequest(locationId, 'POST', '/journalentry', {
        ...journalEntry,
        Id: existingLog.qbo_journal_entry_id,
        SyncToken: existing.SyncToken,
      })
    } else {
      // Existing entry not found — create new
      result = await qboApiRequest(locationId, 'POST', '/journalentry', journalEntry)
    }
  } else {
    result = await qboApiRequest(locationId, 'POST', '/journalentry', journalEntry)
  }

  if (!result.success) {
    // Log failure
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('qbo_sync_log') as any)
      .insert({
        location_id: locationId,
        business_date: businessDate,
        total_revenue: salesData.total_deposit / 100,
        status: 'failed',
        error_message: result.error,
        idempotency_key: idempotencyKey,
      })

    return { success: false, error: result.error }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jeId = (result.data as any)?.JournalEntry?.Id ?? null

  // Log success
  if (existingLog) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('qbo_sync_log') as any)
      .update({
        total_revenue: salesData.total_deposit / 100,
        qbo_journal_entry_id: jeId,
        status: 'success',
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingLog.id)
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('qbo_sync_log') as any)
      .insert({
        location_id: locationId,
        business_date: businessDate,
        total_revenue: salesData.total_deposit / 100,
        qbo_journal_entry_id: jeId,
        status: 'success',
        idempotency_key: idempotencyKey,
      })
  }

  // Update last sync timestamp
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('qbo_connections') as any)
    .update({ last_sync_at: new Date().toISOString() })
    .eq('location_id', locationId)

  return {
    success: true,
    journalEntryId: jeId,
    totalSynced: salesData.total_deposit / 100,
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user
  const roleCheck = requireRole(user, ['owner'])
  if (roleCheck) return roleCheck

  const db = createAdminClient()
  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') ?? 'month'

  const now = new Date()
  let startDate: Date

  switch (period) {
    case 'daily':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      break
    case 'weekly':
      startDate = new Date(now)
      startDate.setDate(startDate.getDate() - 7)
      break
    case 'quarterly':
      startDate = new Date(now)
      startDate.setMonth(startDate.getMonth() - 3)
      break
    case 'yearly':
      startDate = new Date(now.getFullYear(), 0, 1)
      break
    default: // monthly
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
  }

  // Get all locations
  const { data: locations } = await db
    .from('locations')
    .select('id, name')
    .eq('org_id', user.org_id)
    .eq('is_active', true)

  const locationPL = []

  for (const location of locations ?? []) {
    // Revenue from orders
    const { data: orders } = await db
      .from('orders')
      .select('total, subtotal, tax, discount_amount')
      .eq('location_id', location.id)
      .in('status', ['closed', 'served'])
      .gte('created_at', startDate.toISOString())

    const revenue = (orders ?? []).reduce(
      (sum: number, o: Record<string, unknown>) => sum + Math.round(parseFloat(o.total as string) * 100), 0
    )
    const discounts = (orders ?? []).reduce(
      (sum: number, o: Record<string, unknown>) => sum + Math.round(parseFloat((o.discount_amount ?? '0') as string) * 100), 0
    )
    const tax = (orders ?? []).reduce(
      (sum: number, o: Record<string, unknown>) => sum + Math.round(parseFloat((o.tax ?? '0') as string) * 100), 0
    )

    // Labor cost from time entries
    const { data: timeEntries } = await db
      .from('time_entries')
      .select('regular_hours, overtime_hours, hourly_rate')
      .eq('location_id', location.id)
      .gte('clock_in', startDate.toISOString())

    const laborCost = (timeEntries ?? []).reduce((sum: number, te: Record<string, unknown>) => {
      const regular = (te.regular_hours as number ?? 0) * parseFloat(te.hourly_rate as string) * 100
      const overtime = (te.overtime_hours as number ?? 0) * parseFloat(te.hourly_rate as string) * 150
      return sum + Math.round(regular + overtime)
    }, 0)

    // COGS from inventory purchases
    const { data: purchases } = await db
      .from('inventory_purchase_orders')
      .select('total')
      .eq('location_id', location.id)
      .eq('status', 'received')
      .gte('received_at', startDate.toISOString())

    const cogs = (purchases ?? []).reduce(
      (sum: number, po: Record<string, unknown>) => sum + Math.round(parseFloat(po.total as string) * 100), 0
    )

    const grossProfit = revenue - cogs
    const netProfit = grossProfit - laborCost

    locationPL.push({
      location_id: location.id,
      location_name: location.name,
      revenue,
      discounts,
      tax,
      cogs,
      gross_profit: grossProfit,
      labor_cost: laborCost,
      labor_pct: revenue > 0 ? Math.round((laborCost / revenue) * 10000) / 100 : 0,
      food_cost_pct: revenue > 0 ? Math.round((cogs / revenue) * 10000) / 100 : 0,
      net_profit: netProfit,
      net_margin: revenue > 0 ? Math.round((netProfit / revenue) * 10000) / 100 : 0,
    })
  }

  // Totals
  const totals = locationPL.reduce((acc, loc) => ({
    revenue: acc.revenue + loc.revenue,
    cogs: acc.cogs + loc.cogs,
    labor_cost: acc.labor_cost + loc.labor_cost,
    gross_profit: acc.gross_profit + loc.gross_profit,
    net_profit: acc.net_profit + loc.net_profit,
    discounts: acc.discounts + loc.discounts,
    tax: acc.tax + loc.tax,
  }), { revenue: 0, cogs: 0, labor_cost: 0, gross_profit: 0, net_profit: 0, discounts: 0, tax: 0 })

  return NextResponse.json({
    data: {
      period,
      start_date: startDate.toISOString(),
      end_date: now.toISOString(),
      totals: {
        ...totals,
        labor_pct: totals.revenue > 0 ? Math.round((totals.labor_cost / totals.revenue) * 10000) / 100 : 0,
        food_cost_pct: totals.revenue > 0 ? Math.round((totals.cogs / totals.revenue) * 10000) / 100 : 0,
        net_margin: totals.revenue > 0 ? Math.round((totals.net_profit / totals.revenue) * 10000) / 100 : 0,
      },
      locations: locationPL,
    },
  })
}

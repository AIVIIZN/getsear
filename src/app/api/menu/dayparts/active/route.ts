import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'
import { getActiveDayparts, type Daypart } from '@/lib/menu/daypart-engine'
import { resolvePricesBatch, type PriceLevelPrice } from '@/lib/menu/price-resolver'

// ---------------------------------------------------------------------------
// GET /api/menu/dayparts/active
//
// Returns currently active daypart(s) and effective prices for all items.
// Query params: location_id (required), section (optional)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const locationId = request.nextUrl.searchParams.get('location_id')
  if (!locationId) {
    return NextResponse.json({ error: 'location_id is required' }, { status: 400 })
  }

  const section = request.nextUrl.searchParams.get('section') ?? undefined

  const supabase = createAdminClient()

  // Fetch location timezone
  const { data: location, error: locErr } = await supabase
    .from('locations')
    .select('timezone')
    .eq('id', locationId)
    .eq('org_id', user.org_id)
    .single()

  if (locErr || !location) {
    return NextResponse.json({ error: 'Location not found' }, { status: 404 })
  }

  const timezone = location.timezone || 'America/New_York'

  // Fetch all dayparts for this location
  const { data: daypartRows, error: dpErr } = await supabase
    .from('menu_dayparts')
    .select('*')
    .eq('org_id', user.org_id)
    .eq('location_id', locationId)
    .eq('is_active', true)

  if (dpErr) {
    return NextResponse.json({ error: 'Failed to fetch dayparts' }, { status: 500 })
  }

  const dayparts = (daypartRows ?? []) as unknown as Daypart[]
  const now = new Date()
  const activeDayparts = getActiveDayparts(dayparts, timezone, now, section)

  // Pick the primary daypart for pricing
  const primaryDaypart = activeDayparts.length > 0 ? activeDayparts[0] : null
  const activeDaypartId = primaryDaypart?.daypart.id ?? null
  const activeDaypartName = primaryDaypart?.daypart.name ?? null

  // Fetch all active menu items for this location
  const { data: items, error: itemErr } = await supabase
    .from('menu_items')
    .select('id, name, price')
    .eq('org_id', user.org_id)
    .or(`location_id.eq.${locationId},location_id.is.null`)
    .is('deleted_at', null)
    .eq('is_active', true)

  if (itemErr) {
    return NextResponse.json({ error: 'Failed to fetch menu items' }, { status: 500 })
  }

  const menuItems = items ?? []

  // Fetch all price_level_prices for these items
  const itemIds = menuItems.map((i: { id: string }) => i.id)
  const priceLevelMap: Map<string, PriceLevelPrice[]> = new Map()

  if (itemIds.length > 0) {
    const { data: plpRows } = await supabase
      .from('price_level_prices')
      .select('id, menu_item_id, price_level_id, price, daypart_id, price_levels!inner(name)')
      .eq('org_id', user.org_id)
      .in('menu_item_id', itemIds)

    if (plpRows) {
      for (const row of plpRows) {
        const typed = row as unknown as {
          id: string
          menu_item_id: string
          price_level_id: string
          price: string
          daypart_id: string | null
          price_levels: { name: string }
        }
        const existing = priceLevelMap.get(typed.menu_item_id) ?? []
        existing.push({
          id: typed.id,
          price_level_id: typed.price_level_id,
          level_name: typed.price_levels.name,
          price: typed.price,
          daypart_id: typed.daypart_id,
        })
        priceLevelMap.set(typed.menu_item_id, existing)
      }
    }
  }

  // Resolve prices for all items
  const batchInput = menuItems.map((item: { id: string; name: string; price: string }) => ({
    itemId: item.id,
    itemName: item.name,
    basePrice: item.price,
    priceLevelPrices: priceLevelMap.get(item.id) ?? [],
  }))

  const resolvedPrices = resolvePricesBatch(batchInput, activeDaypartId, activeDaypartName)

  return NextResponse.json({
    data: {
      active_dayparts: activeDayparts.map((m) => ({
        id: m.daypart.id,
        name: m.daypart.name,
        start_time: m.daypart.start_time,
        end_time: m.daypart.end_time,
        is_overnight_carryover: m.is_overnight_carryover,
      })),
      primary_daypart: primaryDaypart
        ? {
            id: primaryDaypart.daypart.id,
            name: primaryDaypart.daypart.name,
          }
        : null,
      timezone,
      item_prices: resolvedPrices,
    },
  })
}

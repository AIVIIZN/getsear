import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { generatePrepList } from '@/lib/inventory/prep-list-gen'

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user
  const roleCheck = requireRole(user, ['owner', 'manager', 'kitchen'])
  if (roleCheck) return roleCheck

  const db = createAdminClient()
  const { searchParams } = new URL(request.url)
  const dayOverride = searchParams.get('day_of_week')

  const now = new Date()
  const dayOfWeek = dayOverride ?? DAYS_OF_WEEK[now.getDay()]

  // Fetch active inventory items
  const { data: items, error } = await db
    .from('inventory_items')
    .select('id, name, unit, current_stock, par_level, reorder_point, category')
    .eq('org_id', user.org_id)
    .eq('is_active', true)
    .order('name')

  if (error) {
    return apiError(500, error.message)
  }

  // Fetch historical usage — average daily usage from recipes + order items
  // for this day of week over last 4 weeks
  const historicalUsage = new Map<string, number>()

  // Get recipes linked to inventory items
  const { data: recipes } = await db
    .from('inventory_recipes')
    .select('inventory_item_id, quantity, menu_item_id')
    .eq('org_id', user.org_id)

  if (recipes && recipes.length > 0) {
    // Get order items from the same day-of-week in last 4 weeks
    const targetDow = DAYS_OF_WEEK.indexOf(dayOfWeek)
    const dates: string[] = []
    for (let w = 1; w <= 4; w++) {
      const d = new Date(now)
      d.setDate(d.getDate() - (7 * w) + (targetDow - now.getDay()))
      dates.push(d.toISOString().split('T')[0])
    }

    for (const dateStr of dates) {
      const dayStart = `${dateStr}T00:00:00Z`
      const dayEnd = `${dateStr}T23:59:59Z`
      const { data: orderItems } = await db
        .from('order_items')
        .select('menu_item_id, quantity')
        .eq('org_id', user.org_id)
        .gte('created_at', dayStart)
        .lte('created_at', dayEnd)

      if (orderItems) {
        for (const oi of orderItems) {
          // Find recipes for this menu item
          const matchingRecipes = recipes.filter(
            (r: Record<string, unknown>) => r.menu_item_id === oi.menu_item_id
          )
          for (const recipe of matchingRecipes) {
            const itemId = recipe.inventory_item_id as string
            const usage = (recipe.quantity as number) * (oi.quantity as number)
            const existing = historicalUsage.get(itemId) ?? 0
            historicalUsage.set(itemId, existing + usage)
          }
        }
      }
    }

    // Average over the weeks
    for (const [itemId, total] of historicalUsage.entries()) {
      historicalUsage.set(itemId, total / 4)
    }
  }

  const prepList = generatePrepList(
    (items ?? []).map((i: Record<string, unknown>) => ({
      id: i.id as string,
      name: i.name as string,
      unit: i.unit as string,
      current_stock: i.current_stock as number,
      par_level: i.par_level as number,
      reorder_point: i.reorder_point as number,
      category: (i.category as string) ?? 'General',
    })),
    historicalUsage,
    dayOfWeek
  )

  return NextResponse.json({ data: prepList })
}

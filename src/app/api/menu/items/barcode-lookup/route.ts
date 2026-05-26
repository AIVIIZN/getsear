import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

const querySchema = z.object({
  barcode: z.string().min(1).optional(),
  plu: z.string().min(1).optional(),
}).refine((data) => data.barcode || data.plu, {
  message: 'Either barcode or plu query parameter is required',
})

/**
 * GET /api/menu/items/barcode-lookup?barcode=VALUE or ?plu=VALUE
 *
 * Looks up a menu item by barcode or PLU code. Used by the barcode
 * scanner on POS terminals to quickly add items to an order.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const rawBarcode = url.searchParams.get('barcode')
  const rawPlu = url.searchParams.get('plu')

  const parsed = querySchema.safeParse({
    barcode: rawBarcode || undefined,
    plu: rawPlu || undefined,
  })

  if (!parsed.success) {
    return apiError(400, parsed.error.issues[0].message)
  }

  const { barcode, plu } = parsed.data
  const lookupValue = barcode ?? plu!

  const supabase = createAdminClient()

  // Look up by barcode or plu_code
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('menu_items') as any)
    .select(`
      id,
      name,
      short_name,
      price,
      cost,
      plu_code,
      barcode,
      allergens,
      is_86d,
      is_active,
      is_taxable,
      prep_station,
      course,
      tax_rate_id,
      category_id,
      org_id,
      location_id,
      image_url,
      color
    `)
    .is('deleted_at', null)

  if (barcode) {
    // Try barcode first, then PLU as fallback
    query = query.or(`barcode.eq.${barcode},plu_code.eq.${barcode}`)
  } else {
    query = query.eq('plu_code', plu!)
  }

  const { data: items, error } = await query.limit(1)

  if (error) {
    console.error('[barcode-lookup] Database error:', error)
    return apiError(500, 'Failed to look up item')
  }

  if (!items || items.length === 0) {
    return apiError(404, `No menu item found for ${barcode ? 'barcode' : 'PLU'}: ${lookupValue}`)
  }

  const item = items[0]

  // Fetch modifier groups for this item
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: itemModGroups } = await (supabase.from('menu_item_modifier_groups') as any)
    .select(`
      modifier_group_id,
      sort_order
    `)
    .eq('menu_item_id', item.id)
    .order('sort_order', { ascending: true })

  let modifierGroups: Array<{
    group_id: string
    group_name: string
    min_selections: number
    max_selections: number
    modifiers: Array<{ id: string; name: string; price_adjustment: string }>
  }> = []

  if (itemModGroups && itemModGroups.length > 0) {
    const groupIds = itemModGroups.map((g: { modifier_group_id: string }) => g.modifier_group_id)

    // Fetch the modifier groups
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: groups } = await (supabase.from('modifier_groups') as any)
      .select('id, name, min_selections, max_selections')
      .in('id', groupIds)
      .is('deleted_at', null)

    if (groups) {
      // Fetch all modifiers for these groups
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: modifiers } = await (supabase.from('modifiers') as any)
        .select('id, name, price_adjustment, modifier_group_id, sort_order')
        .in('modifier_group_id', groupIds)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true })

      modifierGroups = groups.map((group: {
        id: string
        name: string
        min_selections: number
        max_selections: number
      }) => ({
        group_id: group.id,
        group_name: group.name,
        min_selections: group.min_selections,
        max_selections: group.max_selections,
        modifiers: (modifiers ?? [])
          .filter((m: { modifier_group_id: string }) => m.modifier_group_id === group.id)
          .map((m: { id: string; name: string; price_adjustment: string }) => ({
            id: m.id,
            name: m.name,
            price_adjustment: m.price_adjustment,
          })),
      }))
    }
  }

  return NextResponse.json({
    data: {
      id: item.id,
      name: item.name,
      short_name: item.short_name,
      price: item.price,
      cost: item.cost,
      plu_code: item.plu_code,
      barcode: item.barcode,
      allergens: item.allergens,
      is_86d: item.is_86d,
      is_active: item.is_active,
      is_taxable: item.is_taxable,
      prep_station: item.prep_station,
      course: item.course,
      tax_rate_id: item.tax_rate_id,
      category_id: item.category_id,
      image_url: item.image_url,
      color: item.color,
      modifier_groups: modifierGroups,
    },
  })
}

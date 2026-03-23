import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Public route — no auth required
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')

  if (!slug) {
    return NextResponse.json({ error: 'Location slug required' }, { status: 400 })
  }

  const db = createAdminClient()

  // Find location by slug
  const { data: location } = await db
    .from('locations')
    .select('id, org_id, name, slug, address, phone, operating_hours')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!location) {
    return NextResponse.json({ error: 'Location not found' }, { status: 404 })
  }

  // Fetch menu categories
  const { data: categories } = await db
    .from('menu_categories')
    .select('id, name, sort_order')
    .eq('org_id', location.org_id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  // Fetch menu items with modifiers
  const { data: items } = await db
    .from('menu_items')
    .select('id, name, description, price, category_id, image_url, is_available, menu_modifiers(id, name, required, max_selections, menu_modifier_options(id, name, price))')
    .eq('org_id', location.org_id)
    .eq('is_active', true)
    .eq('is_available', true)
    .order('name')

  // Check online ordering settings
  const { data: settings } = await db
    .from('online_ordering_settings')
    .select('*')
    .eq('location_id', location.id)
    .single()

  const menuItems = (items ?? []).map((item: Record<string, unknown>) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    price: Math.round(parseFloat(item.price as string) * 100),
    category_id: item.category_id,
    category_name: (categories ?? []).find((c: Record<string, unknown>) => c.id === item.category_id)?.name ?? '',
    image_url: item.image_url,
    modifiers: ((item.menu_modifiers as Array<Record<string, unknown>>) ?? []).map((mod) => ({
      id: mod.id,
      name: mod.name,
      required: mod.required,
      max_selections: mod.max_selections,
      options: ((mod.menu_modifier_options as Array<Record<string, unknown>>) ?? []).map((opt) => ({
        id: opt.id,
        name: opt.name,
        price: Math.round(parseFloat(opt.price as string) * 100),
      })),
    })),
    is_available: item.is_available,
  }))

  return NextResponse.json({
    data: {
      location: {
        id: location.id,
        name: location.name,
        slug: location.slug,
        address: location.address,
        phone: location.phone,
        operating_hours: location.operating_hours,
      },
      categories: categories ?? [],
      items: menuItems,
      settings: {
        is_accepting_orders: settings?.is_active ?? true,
        max_orders_per_slot: settings?.max_orders_per_slot ?? 10,
        lead_time_minutes: settings?.lead_time_minutes ?? 30,
        allow_scheduled: settings?.allow_scheduled ?? true,
        delivery_enabled: settings?.delivery_enabled ?? false,
        min_order_amount: settings?.min_order_amount ? Math.round(parseFloat(settings.min_order_amount as string) * 100) : 0,
      },
    },
  })
}

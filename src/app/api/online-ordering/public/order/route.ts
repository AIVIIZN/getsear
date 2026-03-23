import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

const orderItemSchema = z.object({
  menu_item_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  modifiers: z.array(
    z.object({
      modifier_id: z.string().uuid(),
      option_id: z.string().uuid(),
    })
  ).optional(),
  special_instructions: z.string().optional(),
})

const orderSchema = z.object({
  location_slug: z.string(),
  customer_name: z.string().min(1),
  customer_phone: z.string().min(10),
  order_type: z.enum(['pickup', 'delivery']),
  items: z.array(orderItemSchema).min(1),
  scheduled_time: z.string().optional(),
  delivery_address: z.string().optional(),
  notes: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = orderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const db = createAdminClient()
  const { location_slug, customer_name, customer_phone, order_type, items, scheduled_time, delivery_address, notes } = parsed.data

  // Find location
  const { data: location } = await db
    .from('locations')
    .select('id, org_id')
    .eq('slug', location_slug)
    .eq('is_active', true)
    .single()

  if (!location) {
    return NextResponse.json({ error: 'Location not found' }, { status: 404 })
  }

  // Check throttle — count orders in current 15-min slot
  const { data: settings } = await db
    .from('online_ordering_settings')
    .select('max_orders_per_slot, is_active')
    .eq('location_id', location.id)
    .single()

  if (settings && !settings.is_active) {
    return NextResponse.json({ error: 'Online ordering is currently closed' }, { status: 503 })
  }

  const maxPerSlot = (settings?.max_orders_per_slot as number) ?? 10
  const now = new Date()
  const slotStart = new Date(now)
  slotStart.setMinutes(Math.floor(slotStart.getMinutes() / 15) * 15, 0, 0)

  const { count: slotCount } = await db
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', location.id)
    .eq('order_type', 'online')
    .gte('created_at', slotStart.toISOString())

  if ((slotCount ?? 0) >= maxPerSlot) {
    const nextSlot = new Date(slotStart)
    nextSlot.setMinutes(nextSlot.getMinutes() + 15)
    const minsUntil = Math.ceil((nextSlot.getTime() - now.getTime()) / 60000)
    return NextResponse.json(
      {
        error: `We're busy right now. Please try again in ${minsUntil} minute${minsUntil > 1 ? 's' : ''}.`,
        throttled: true,
        retry_after_minutes: minsUntil,
      },
      { status: 429 }
    )
  }

  // Calculate order total
  let orderTotal = 0
  const orderItems: Array<Record<string, unknown>> = []

  for (const item of items) {
    const { data: menuItem } = await db
      .from('menu_items')
      .select('id, name, price')
      .eq('id', item.menu_item_id)
      .single()

    if (!menuItem) continue

    let itemPrice = Math.round(parseFloat(menuItem.price as string) * 100)

    // Add modifier prices
    if (item.modifiers) {
      for (const mod of item.modifiers) {
        const { data: modOption } = await db
          .from('menu_modifier_options')
          .select('price')
          .eq('id', mod.option_id)
          .single()
        if (modOption) {
          itemPrice += Math.round(parseFloat(modOption.price as string) * 100)
        }
      }
    }

    const subtotal = itemPrice * item.quantity
    orderTotal += subtotal

    orderItems.push({
      menu_item_id: item.menu_item_id,
      name: menuItem.name,
      quantity: item.quantity,
      unit_price: (itemPrice / 100).toFixed(2),
      subtotal: (subtotal / 100).toFixed(2),
      modifiers: item.modifiers ?? [],
      special_instructions: item.special_instructions ?? null,
    })
  }

  // Create order
  const { data: order, error: orderError } = await db
    .from('orders')
    .insert({
      org_id: location.org_id,
      location_id: location.id,
      order_type: 'online',
      status: 'pending',
      subtotal: (orderTotal / 100).toFixed(2),
      total: (orderTotal / 100).toFixed(2),
      customer_name,
      customer_phone: customer_phone.replace(/\D/g, ''),
      delivery_address: delivery_address ?? null,
      scheduled_for: scheduled_time ?? null,
      notes: notes ?? null,
      source: 'online',
    })
    .select()
    .single()

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 })
  }

  // Insert order items
  for (const item of orderItems) {
    await db.from('order_items').insert({
      order_id: order.id,
      org_id: location.org_id,
      ...item,
    })
  }

  // Add to online ordering queue
  await db.from('online_order_queue').insert({
    order_id: order.id,
    org_id: location.org_id,
    location_id: location.id,
    status: 'pending',
  })

  return NextResponse.json({
    data: {
      order_id: order.id,
      status: 'pending',
      estimated_time: scheduled_time ?? `${30} minutes`,
      total: (orderTotal / 100).toFixed(2),
    },
  }, { status: 201 })
}

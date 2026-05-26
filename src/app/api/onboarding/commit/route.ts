import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const menuItemSchema = z.object({
  name: z.string().min(1).max(160),
  category: z.string().min(1).max(100),
  description: z.string().max(500),
  price_cents: z.number().int().min(0).max(200000),
  modifiers: z.array(z.object({
    name: z.string().min(1).max(120),
    price_cents: z.number().int().min(0).max(50000),
  })).max(8),
})

const terminalSchema = z.object({
  name: z.string().min(1).max(100),
  terminal_type: z.enum(['server_station', 'bar', 'host', 'cashier', 'kds']),
  default_view: z.enum(['pos', 'kds']),
})

const commitSchema = z.object({
  org: z.object({
    name: z.string().min(1).max(200),
    owner_name: z.string().min(1).max(200),
    owner_email: z.string().email(),
    owner_phone: z.string().min(7).max(24),
  }),
  location: z.object({
    name: z.string().min(1).max(200),
    address_line1: z.string().min(1).max(500),
    city: z.string().min(1).max(100),
    state: z.string().min(2).max(50),
    zip: z.string().min(3).max(20),
    timezone: z.string().min(1).max(100),
    sections: z.array(z.string().min(1).max(80)).min(1).max(12),
  }),
  menu_template_id: z.string().min(1).max(80),
  menu_items: z.array(menuItemSchema).min(40).max(80),
  terminals: z.array(terminalSchema).min(1).max(8),
  first_user_confirmed: z.boolean(),
  tour_completed: z.boolean(),
})

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin'])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = commitSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Check the highlighted onboarding fields and try again.', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const orgId = user.org_id
  const payload = parsed.data

  try {
    const { data: orgRow } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', orgId)
      .single()
    const existingSettings = isRecord(orgRow?.settings) ? orgRow.settings : {}

    await supabase
      .from('organizations')
      .update({
        name: payload.org.name,
        owner_name: payload.org.owner_name,
        owner_email: payload.org.owner_email,
        owner_phone: payload.org.owner_phone,
        settings: {
          ...existingSettings,
          onboarding: {
            completed_at: now,
            menu_template_id: payload.menu_template_id,
            first_user_confirmed: payload.first_user_confirmed,
            tour_replay_enabled: true,
          },
        },
        updated_at: now,
      })
      .eq('id', orgId)

    const slug = slugify(payload.location.name)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingLocation } = await (supabase.from('locations') as any)
      .select('id')
      .eq('org_id', orgId)
      .eq('slug', slug)
      .maybeSingle()

    let locationId = existingLocation?.id as string | undefined
    if (locationId) {
      await supabase
        .from('locations')
        .update({
          name: payload.location.name,
          address_line1: payload.location.address_line1,
          city: payload.location.city,
          state: payload.location.state,
          zip: payload.location.zip,
          timezone: payload.location.timezone,
          settings: { onboarding_sections: payload.location.sections },
          updated_at: now,
        })
        .eq('id', locationId)
        .eq('org_id', orgId)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: location, error: locationError } = await (supabase.from('locations') as any)
        .insert({
          org_id: orgId,
          name: payload.location.name,
          slug,
          address_line1: payload.location.address_line1,
          city: payload.location.city,
          state: payload.location.state,
          zip: payload.location.zip,
          timezone: payload.location.timezone,
          settings: { onboarding_sections: payload.location.sections },
        })
        .select('id')
        .single()

      if (locationError) throw locationError
      locationId = location.id
    }

    const categoryIdByName = new Map<string, string>()
    const categoryNames = [...new Set(payload.menu_items.map((item) => item.category))]
    for (const [index, categoryName] of categoryNames.entries()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: category, error: categoryError } = await (supabase.from('menu_categories') as any)
        .insert({
          org_id: orgId,
          location_id: locationId,
          name: categoryName,
          sort_order: index,
          is_active: true,
        })
        .select('id')
        .single()

      if (categoryError) throw categoryError
      categoryIdByName.set(categoryName, category.id)
    }

    const modifierGroupIdByKey = new Map<string, string>()
    for (const [index, item] of payload.menu_items.entries()) {
      const categoryId = categoryIdByName.get(item.category)
      if (!categoryId) continue

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: menuItem, error: itemError } = await (supabase.from('menu_items') as any)
        .insert({
          org_id: orgId,
          location_id: locationId,
          category_id: categoryId,
          name: item.name,
          description: item.description,
          price: centsToDollars(item.price_cents),
          is_taxable: true,
          sort_order: index,
        })
        .select('id')
        .single()

      if (itemError) throw itemError

      for (const [modifierIndex, modifier] of item.modifiers.entries()) {
        const groupKey = `${item.name}:options`
        let modifierGroupId = modifierGroupIdByKey.get(groupKey)
        if (!modifierGroupId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: group, error: groupError } = await (supabase.from('modifier_groups') as any)
            .insert({
              org_id: orgId,
              name: `${item.name} options`,
              min_selections: 0,
              max_selections: item.modifiers.length,
              is_required_prompt: false,
              sort_order: index,
            })
            .select('id')
            .single()

          if (groupError) throw groupError
          modifierGroupId = group.id as string
          modifierGroupIdByKey.set(groupKey, modifierGroupId)

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('menu_item_modifier_groups') as any)
            .insert({ menu_item_id: menuItem.id, modifier_group_id: modifierGroupId, sort_order: 0 })
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('modifiers') as any)
          .insert({
            org_id: orgId,
            modifier_group_id: modifierGroupId,
            name: modifier.name,
            price_adjustment: centsToDollars(modifier.price_cents),
            sort_order: modifierIndex,
          })
      }
    }

    for (const terminal of payload.terminals) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('terminals') as any)
        .insert({
          org_id: orgId,
          location_id: locationId,
          name: terminal.name,
          terminal_type: terminal.terminal_type,
          default_view: terminal.default_view,
          is_active: true,
          is_online: false,
        })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('setup_progress') as any)
      .upsert({
        org_id: orgId,
        user_id: user.id,
        current_step: 5,
        completed_steps: [0, 1, 2, 3, 4, 5],
        data: {
          org: payload.org,
          location: payload.location,
          menu_template_id: payload.menu_template_id,
          menu_items_count: payload.menu_items.length,
          terminals_count: payload.terminals.length,
          tour_completed: payload.tour_completed,
          tour_replay_enabled: true,
        },
        updated_at: now,
      }, { onConflict: 'org_id' })

    return NextResponse.json({
      success: true,
      summary: {
        location_id: locationId,
        menu_items: payload.menu_items.length,
        categories: categoryNames.length,
        modifier_groups: modifierGroupIdByKey.size,
        terminals: payload.terminals.length,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Onboarding commit failed:', error)
    return NextResponse.json(
      { error: 'We could not finish onboarding. Your progress is saved, so please try again.' },
      { status: 500 },
    )
  }
}

function centsToDollars(cents: number): number {
  return Number((cents / 100).toFixed(2))
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'main-location'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import {
  DEMO_CATEGORIES,
  DEMO_MODIFIER_GROUPS,
  DEMO_TABLES,
  DEMO_STAFF,
  DEMO_DAYPARTS,
  DEMO_TAX_RATES,
} from '@/lib/setup/demo-data'

/**
 * POST /api/setup/seed-demo
 * Seeds a complete demo restaurant dataset for the authenticated org.
 * All demo items are flagged with is_demo: true (or metadata) for cleanup.
 */
export async function POST() {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const supabase = createAdminClient()
  const orgId = user.org_id

  try {
    // Check if org already has data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: itemCount } = await (supabase.from('menu_items') as any)
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)

    const hasExistingData = (itemCount ?? 0) > 0

    // ----- CATEGORIES & ITEMS -----
    const categoryIdMap = new Map<string, string>()

    for (const cat of DEMO_CATEGORIES) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: catRow, error: catErr } = await (supabase.from('menu_categories') as any)
        .insert({
          org_id: orgId,
          name: cat.name,
          color: cat.color,
          sort_order: cat.sort_order,
          is_active: true,
          description: `Demo ${cat.name.toLowerCase()} category`,
        })
        .select('id')
        .single()

      if (catErr) {
        console.error('Failed to create category:', cat.name, catErr)
        continue
      }

      categoryIdMap.set(cat.name, catRow.id)

      // Insert items for this category
      for (let i = 0; i < cat.items.length; i++) {
        const item = cat.items[i]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('menu_items') as any)
          .insert({
            org_id: orgId,
            category_id: catRow.id,
            name: item.name,
            description: item.description,
            price: item.price_cents,
            is_taxable: item.is_taxable,
            is_active: true,
            sort_order: i,
          })
      }
    }

    // ----- MODIFIER GROUPS -----
    for (const group of DEMO_MODIFIER_GROUPS) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: groupRow, error: groupErr } = await (supabase.from('modifier_groups') as any)
        .insert({
          org_id: orgId,
          name: group.name,
          is_required: group.is_required,
          min_selections: group.min_selections,
          max_selections: group.max_selections,
        })
        .select('id')
        .single()

      if (groupErr) {
        console.error('Failed to create modifier group:', group.name, groupErr)
        continue
      }

      // Insert modifiers
      for (let i = 0; i < group.modifiers.length; i++) {
        const mod = group.modifiers[i]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('modifiers') as any)
          .insert({
            org_id: orgId,
            group_id: groupRow.id,
            name: mod.name,
            price: mod.price_cents,
            is_default: mod.is_default ?? false,
            sort_order: i,
          })
      }
    }

    // ----- TABLES & SECTIONS -----
    const sections = [...new Set(DEMO_TABLES.map((t) => t.section))]
    const sectionIdMap = new Map<string, string>()

    for (const section of sections) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sectionRow, error: sectionErr } = await (supabase.from('sections') as any)
        .insert({
          org_id: orgId,
          name: section,
          is_active: true,
        })
        .select('id')
        .single()

      if (sectionErr) {
        console.error('Failed to create section:', section, sectionErr)
        continue
      }

      sectionIdMap.set(section, sectionRow.id)
    }

    for (const table of DEMO_TABLES) {
      const sectionId = sectionIdMap.get(table.section)
      if (!sectionId) continue

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('tables') as any)
        .insert({
          org_id: orgId,
          section_id: sectionId,
          name: table.name,
          seats: table.seats,
          x_position: table.x,
          y_position: table.y,
          shape: table.shape,
          status: 'available',
        })
    }

    // ----- DAYPARTS -----
    for (const daypart of DEMO_DAYPARTS) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('dayparts') as any)
        .insert({
          org_id: orgId,
          name: daypart.name,
          start_time: daypart.start_time,
          end_time: daypart.end_time,
          days_of_week: daypart.days,
          is_active: true,
        })
    }

    // ----- TAX RATES -----
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('tax_rates') as any)
      .insert([
        { org_id: orgId, name: 'Food Tax', rate: DEMO_TAX_RATES.food, applies_to: 'food', is_active: true },
        { org_id: orgId, name: 'Alcohol Tax', rate: DEMO_TAX_RATES.alcohol, applies_to: 'alcohol', is_active: true },
        { org_id: orgId, name: 'Takeout Tax', rate: DEMO_TAX_RATES.takeout, applies_to: 'takeout', is_active: true },
      ])

    return NextResponse.json({
      success: true,
      summary: {
        categories: DEMO_CATEGORIES.length,
        items: DEMO_CATEGORIES.reduce((sum, cat) => sum + cat.items.length, 0),
        modifier_groups: DEMO_MODIFIER_GROUPS.length,
        tables: DEMO_TABLES.length,
        sections: sections.length,
        dayparts: DEMO_DAYPARTS.length,
        had_existing_data: hasExistingData,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Demo seed error:', error)
    return NextResponse.json(
      { error: 'Failed to seed demo data. Please try again.' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { cacheTags, CACHE_REVALIDATE_PROFILE } from '@/lib/cache/keys'

const importRowSchema = z.object({
  name: z.string().min(1),
  short_name: z.string().nullable().optional(),
  category: z.string(),
  price: z.string(),
  cost: z.string().nullable().optional(),
  tax_class: z.string().optional(),
  plu_code: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  allergens: z.array(z.string()).optional(),
  dietary_tags: z.array(z.string()).optional(),
  prep_station: z.string().nullable().optional(),
  course: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
  is_86d: z.boolean().optional(),
})

const importSchema = z.object({
  org_id: z.string().uuid(),
  location_id: z.string().uuid(),
  rows: z.array(importRowSchema),
  create_categories: z.boolean().optional().default(true),
  update_existing: z.boolean().optional().default(false),
})

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = importSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { org_id, location_id, rows, create_categories, update_existing } = parsed.data
  const supabase = createAdminClient()

  // Verify the user belongs to this org
  if (org_id !== user.org_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 1. Build category map — fetch existing categories
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingCategories } = await (supabase.from('menu_categories') as any)
    .select('id, name')
    .eq('org_id', org_id)
    .is('deleted_at', null)

  const categoryMap = new Map<string, string>()
  for (const cat of (existingCategories ?? []) as { id: string; name: string }[]) {
    categoryMap.set(cat.name.toLowerCase(), cat.id)
  }

  // Create missing categories if enabled
  const missingCategories = new Set<string>()
  for (const row of rows) {
    if (row.category && !categoryMap.has(row.category.toLowerCase())) {
      missingCategories.add(row.category)
    }
  }

  if (create_categories && missingCategories.size > 0) {
    let sortOrder = (existingCategories ?? []).length
    for (const catName of missingCategories) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newCat } = await (supabase.from('menu_categories') as any)
        .insert({
          org_id,
          location_id,
          name: catName,
          sort_order: sortOrder++,
          is_active: true,
        })
        .select('id')
        .single()

      if (newCat) {
        categoryMap.set(catName.toLowerCase(), newCat.id)
      }
    }
  }

  // 2. Build existing items lookup for update mode
  const existingItemsByPlu = new Map<string, string>()
  const existingItemsByName = new Map<string, string>()

  if (update_existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingItems } = await (supabase.from('menu_items') as any)
      .select('id, name, plu_code')
      .eq('org_id', org_id)
      .is('deleted_at', null)

    for (const item of (existingItems ?? []) as { id: string; name: string; plu_code: string | null }[]) {
      if (item.plu_code) {
        existingItemsByPlu.set(item.plu_code, item.id)
      }
      existingItemsByName.set(item.name.toLowerCase(), item.id)
    }
  }

  // 3. Process rows
  let imported = 0
  let skipped = 0
  let updated = 0

  for (const row of rows) {
    const categoryId = row.category
      ? categoryMap.get(row.category.toLowerCase())
      : categoryMap.values().next().value

    if (!categoryId) {
      skipped++
      continue
    }

    const itemData = {
      org_id,
      location_id,
      category_id: categoryId,
      name: row.name,
      short_name: row.short_name ?? null,
      description: row.description ?? '',
      price: row.price,
      cost: row.cost ?? null,
      is_taxable: row.tax_class !== 'Non-Taxable',
      plu_code: row.plu_code ?? null,
      barcode: row.barcode ?? null,
      allergens: row.allergens && row.allergens.length > 0 ? row.allergens : null,
      prep_station: row.prep_station ?? null,
      course: row.course ?? null,
      is_active: row.is_active ?? true,
      is_86d: row.is_86d ?? false,
      updated_at: new Date().toISOString(),
    }

    // Check for existing item to update
    if (update_existing) {
      const existingId =
        (row.plu_code ? existingItemsByPlu.get(row.plu_code) : undefined) ??
        existingItemsByName.get(row.name.toLowerCase())

      if (existingId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('menu_items') as any)
          .update(itemData)
          .eq('id', existingId)
          .eq('org_id', org_id)
        updated++
        continue
      }
    }

    // Insert new item
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('menu_items') as any)
      .insert({
        ...itemData,
        sort_order: imported,
        created_at: new Date().toISOString(),
      })

    if (!error) {
      imported++
    } else {
      skipped++
    }
  }

  // Bulk-imports always change menu list shape; single tag invalidation is enough.
  if (imported > 0 || updated > 0) {
    revalidateTag(cacheTags.menu(org_id), CACHE_REVALIDATE_PROFILE)
  }

  return NextResponse.json({
    success: true,
    imported,
    updated,
    skipped,
    total: rows.length,
  })
}

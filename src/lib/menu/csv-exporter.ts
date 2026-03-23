/**
 * CSV export for menu items.
 * Produces a standards-compliant CSV with proper escaping.
 */

import { createAdminClient } from '@/lib/supabase/admin'

const CSV_COLUMNS = [
  'Name',
  'Short Name',
  'Category',
  'Price',
  'Cost',
  'Tax Class',
  'PLU',
  'Barcode',
  'Description',
  'Allergens',
  'Dietary Tags',
  'Prep Station',
  'Course',
  'Active',
  '86d',
] as const

/**
 * Escape a value for CSV. Wraps in quotes if it contains commas, quotes, or newlines.
 */
function csvEscape(value: string | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

interface ExportOptions {
  categoryId?: string
  activeOnly?: boolean
}

/**
 * Export all menu items for a location as a CSV string.
 */
export async function exportMenuCSV(
  orgId: string,
  locationId: string,
  options?: ExportOptions
): Promise<string> {
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('menu_items') as any)
    .select(`
      name,
      short_name,
      description,
      price,
      cost,
      is_taxable,
      prep_station,
      course,
      is_active,
      is_86d,
      allergens,
      plu_code,
      barcode,
      menu_categories!inner ( name )
    `)
    .eq('org_id', orgId)
    .or(`location_id.eq.${locationId},location_id.is.null`)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })

  if (options?.categoryId) {
    query = query.eq('category_id', options.categoryId)
  }

  if (options?.activeOnly) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query

  if (error || !data) {
    console.error('exportMenuCSV error:', error)
    return CSV_COLUMNS.join(',') + '\n'
  }

  const header = CSV_COLUMNS.join(',')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data as any[]).map((item) => {
    const allergens = Array.isArray(item.allergens) ? item.allergens.join('; ') : ''
    // dietary_tags column may not exist yet on all items
    const dietaryTags = Array.isArray(item.dietary_tags) ? item.dietary_tags.join('; ') : ''

    return [
      csvEscape(item.name),
      csvEscape(item.short_name),
      csvEscape(item.menu_categories?.name),
      csvEscape(item.price),
      csvEscape(item.cost),
      csvEscape(item.is_taxable ? 'Taxable' : 'Non-Taxable'),
      csvEscape(item.plu_code),
      csvEscape(item.barcode),
      csvEscape(item.description),
      csvEscape(allergens),
      csvEscape(dietaryTags),
      csvEscape(item.prep_station),
      csvEscape(item.course),
      csvEscape(item.is_active ? 'Yes' : 'No'),
      csvEscape(item.is_86d ? 'Yes' : 'No'),
    ].join(',')
  })

  return [header, ...rows].join('\n')
}

/**
 * Generate a CSV template with headers and one example row.
 */
export function generateCSVTemplate(): string {
  const header = CSV_COLUMNS.join(',')
  const example = [
    'Grilled Salmon',
    'GRL SALMN',
    'Entrees',
    '24.99',
    '8.50',
    'Taxable',
    '1001',
    '',
    'Fresh Atlantic salmon with lemon herb butter',
    'fish; milk',
    'gluten_free',
    'grill',
    'entree',
    'Yes',
    'No',
  ].join(',')

  return [header, example].join('\n')
}

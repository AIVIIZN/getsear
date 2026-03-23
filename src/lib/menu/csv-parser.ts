/**
 * CSV parser for menu item imports.
 *
 * Parses CSV text, validates each row, and returns structured results
 * with per-row validation status.
 */

import { ALL_ALLERGENS, DIETARY_TAGS } from './allergen-constants'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedRow {
  rowNumber: number
  name: string
  short_name: string | null
  category: string
  price: string
  cost: string | null
  tax_class: string
  plu_code: string | null
  barcode: string | null
  description: string | null
  allergens: string[]
  dietary_tags: string[]
  prep_station: string | null
  course: string | null
  is_active: boolean
  is_86d: boolean
  status: 'valid' | 'warning' | 'error'
  errors: string[]
  warnings: string[]
}

export interface ParseResult {
  valid: ParsedRow[]
  invalid: ParsedRow[]
  all: ParsedRow[]
  totalRows: number
  validCount: number
  errorCount: number
  warningCount: number
}

// ---------------------------------------------------------------------------
// CSV text parsing
// ---------------------------------------------------------------------------

/**
 * Parse a CSV string into an array of string arrays, handling quoted fields.
 */
function parseCSVText(text: string): string[][] {
  const rows: string[][] = []
  const lines = text.split(/\r?\n/)
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx]

    for (let i = 0; i < line.length; i++) {
      const char = line[i]

      if (inQuotes) {
        if (char === '"') {
          // Check for escaped quote
          if (i + 1 < line.length && line[i + 1] === '"') {
            currentField += '"'
            i++ // skip next quote
          } else {
            inQuotes = false
          }
        } else {
          currentField += char
        }
      } else {
        if (char === '"') {
          inQuotes = true
        } else if (char === ',') {
          currentRow.push(currentField.trim())
          currentField = ''
        } else {
          currentField += char
        }
      }
    }

    if (inQuotes) {
      // Field spans multiple lines
      currentField += '\n'
    } else {
      currentRow.push(currentField.trim())
      currentField = ''
      if (currentRow.some((f) => f !== '')) {
        rows.push(currentRow)
      }
      currentRow = []
    }
  }

  // Handle last row if no trailing newline
  if (currentRow.length > 0 || currentField) {
    currentRow.push(currentField.trim())
    if (currentRow.some((f) => f !== '')) {
      rows.push(currentRow)
    }
  }

  return rows
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const VALID_ALLERGEN_IDS = new Set(ALL_ALLERGENS.map((a) => a.id))
const VALID_DIETARY_IDS = new Set(DIETARY_TAGS.map((t) => t.id))
const PRICE_REGEX = /^\d+(\.\d{1,2})?$/
const VALID_STATIONS = new Set(['grill', 'saute', 'fry', 'expo', 'cold', 'pizza', 'bar', 'pastry'])
const VALID_COURSES = new Set(['appetizer', 'soup', 'salad', 'entree', 'dessert', 'beverage'])

/**
 * Map column headers (case-insensitive) to field names.
 */
function mapHeaders(headers: string[]): Map<string, number> {
  const map = new Map<string, number>()
  const aliases: Record<string, string[]> = {
    name: ['name', 'item name', 'menu item'],
    short_name: ['short name', 'short_name', 'kds name', 'abbreviation'],
    category: ['category', 'cat', 'menu category'],
    price: ['price', 'base price', 'cash price'],
    cost: ['cost', 'food cost'],
    tax_class: ['tax class', 'tax_class', 'taxable'],
    plu_code: ['plu', 'plu code', 'plu_code', 'lookup code'],
    barcode: ['barcode', 'upc', 'sku'],
    description: ['description', 'desc'],
    allergens: ['allergens', 'allergen', 'allergies'],
    dietary_tags: ['dietary tags', 'dietary_tags', 'dietary', 'tags', 'diet'],
    prep_station: ['prep station', 'prep_station', 'station', 'station routing'],
    course: ['course'],
    is_active: ['active', 'is_active', 'enabled'],
    is_86d: ['86d', '86\'d', 'is_86d', 'eighty-sixed', '86'],
  }

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase().trim()
    for (const [field, names] of Object.entries(aliases)) {
      if (names.includes(h)) {
        map.set(field, i)
        break
      }
    }
  }

  return map
}

/**
 * Parse and validate a CSV string of menu items.
 */
export function parseMenuCSV(csvString: string): ParseResult {
  const rawRows = parseCSVText(csvString)

  if (rawRows.length < 2) {
    return {
      valid: [],
      invalid: [],
      all: [],
      totalRows: 0,
      validCount: 0,
      errorCount: 0,
      warningCount: 0,
    }
  }

  const headerRow = rawRows[0]
  const columnMap = mapHeaders(headerRow)
  const dataRows = rawRows.slice(1)

  const seenPLUs = new Map<string, number>()
  const results: ParsedRow[] = []

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const rowNum = i + 2 // 1-indexed, skip header
    const errors: string[] = []
    const warnings: string[] = []

    const getField = (field: string): string => {
      const idx = columnMap.get(field)
      if (idx === undefined || idx >= row.length) return ''
      return row[idx].trim()
    }

    // Required: name
    const name = getField('name')
    if (!name) {
      errors.push('Missing required field: Name')
    }

    // Required: price
    const priceStr = getField('price')
    if (!priceStr) {
      errors.push('Missing required field: Price')
    } else if (!PRICE_REGEX.test(priceStr)) {
      errors.push(`Invalid price format: "${priceStr}" (expected e.g. 12.99)`)
    }

    // Category
    const category = getField('category')
    if (!category) {
      warnings.push('No category specified; will need to assign manually')
    }

    // PLU uniqueness
    const pluCode = getField('plu_code') || null
    if (pluCode) {
      const prevRow = seenPLUs.get(pluCode)
      if (prevRow !== undefined) {
        errors.push(`Duplicate PLU "${pluCode}" (also on row ${prevRow})`)
      } else {
        seenPLUs.set(pluCode, rowNum)
      }
    }

    // Cost validation
    const costStr = getField('cost') || null
    if (costStr && !PRICE_REGEX.test(costStr)) {
      warnings.push(`Invalid cost format: "${costStr}"`)
    }

    // Allergens parsing
    const allergensRaw = getField('allergens')
    const allergens: string[] = []
    if (allergensRaw) {
      const parts = allergensRaw.split(/[;,]/).map((s) => s.trim().toLowerCase().replace(/\s+/g, '_'))
      for (const part of parts) {
        if (part && VALID_ALLERGEN_IDS.has(part)) {
          allergens.push(part)
        } else if (part) {
          warnings.push(`Unknown allergen code: "${part}"`)
        }
      }
    }

    // Dietary tags parsing
    const dietaryRaw = getField('dietary_tags')
    const dietaryTags: string[] = []
    if (dietaryRaw) {
      const parts = dietaryRaw.split(/[;,]/).map((s) => s.trim().toLowerCase().replace(/[\s-]+/g, '_'))
      for (const part of parts) {
        if (part && VALID_DIETARY_IDS.has(part)) {
          dietaryTags.push(part)
        } else if (part) {
          warnings.push(`Unknown dietary tag: "${part}"`)
        }
      }
    }

    // Station validation
    const prepStation = getField('prep_station') || null
    if (prepStation && !VALID_STATIONS.has(prepStation.toLowerCase())) {
      warnings.push(`Unknown prep station: "${prepStation}"`)
    }

    // Course validation
    const course = getField('course') || null
    if (course && !VALID_COURSES.has(course.toLowerCase())) {
      warnings.push(`Unknown course: "${course}"`)
    }

    // Boolean fields
    const activeRaw = getField('is_active').toLowerCase()
    const is_active = activeRaw !== 'no' && activeRaw !== 'false' && activeRaw !== '0'

    const is86dRaw = getField('is_86d').toLowerCase()
    const is_86d = is86dRaw === 'yes' || is86dRaw === 'true' || is86dRaw === '1'

    // Tax class
    const taxClass = getField('tax_class') || 'Taxable'

    const status: 'valid' | 'warning' | 'error' =
      errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'valid'

    results.push({
      rowNumber: rowNum,
      name,
      short_name: getField('short_name') || null,
      category,
      price: priceStr,
      cost: costStr,
      tax_class: taxClass,
      plu_code: pluCode,
      barcode: getField('barcode') || null,
      description: getField('description') || null,
      allergens,
      dietary_tags: dietaryTags,
      prep_station: prepStation?.toLowerCase() ?? null,
      course: course?.toLowerCase() ?? null,
      is_active,
      is_86d,
      status,
      errors,
      warnings,
    })
  }

  const valid = results.filter((r) => r.status !== 'error')
  const invalid = results.filter((r) => r.status === 'error')

  return {
    valid,
    invalid,
    all: results,
    totalRows: results.length,
    validCount: valid.length,
    errorCount: invalid.length,
    warningCount: results.filter((r) => r.status === 'warning').length,
  }
}

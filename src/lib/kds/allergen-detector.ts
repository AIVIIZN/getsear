/**
 * Allergen Detection Utility for KDS
 *
 * Checks order item special instructions and customer allergen profiles
 * for allergy-related keywords. False positives are acceptable;
 * false negatives are NOT -- this is a safety feature.
 */

/** Keywords that trigger an allergen alert when found in special_instructions */
const ALLERGEN_KEYWORDS = [
  'allergy',
  'allergic',
  'allergen',
  'celiac',
  'anaphylaxis',
  'anaphylactic',
  'epipen',
  'epi-pen',
  'epi pen',
  'nut',
  'peanut',
  'tree nut',
  'gluten',
  'gluten-free',
  'gluten free',
  'dairy',
  'dairy-free',
  'dairy free',
  'lactose',
  'shellfish',
  'shrimp',
  'crab',
  'lobster',
  'soy',
  'soybean',
  'egg',
  'eggs',
  'wheat',
  'fish',
  'sesame',
  'mustard',
  'sulfite',
  'sulfites',
  'corn',
  'msg',
] as const

/** Known allergen names for display (when detected generically) */
const SPECIFIC_ALLERGENS: Record<string, string> = {
  nut: 'Nuts',
  peanut: 'Peanuts',
  'tree nut': 'Tree Nuts',
  gluten: 'Gluten',
  'gluten-free': 'Gluten',
  'gluten free': 'Gluten',
  celiac: 'Gluten',
  dairy: 'Dairy',
  'dairy-free': 'Dairy',
  'dairy free': 'Dairy',
  lactose: 'Dairy',
  shellfish: 'Shellfish',
  shrimp: 'Shellfish',
  crab: 'Shellfish',
  lobster: 'Shellfish',
  soy: 'Soy',
  soybean: 'Soy',
  egg: 'Eggs',
  eggs: 'Eggs',
  wheat: 'Wheat',
  fish: 'Fish',
  sesame: 'Sesame',
  mustard: 'Mustard',
  sulfite: 'Sulfites',
  sulfites: 'Sulfites',
  corn: 'Corn',
}

interface AllergenResult {
  hasAllergens: boolean
  allergenList: string[] // deduplicated, display-ready names
  rawMatches: string[] // actual keywords matched
}

/**
 * Detect allergens from special instructions text.
 */
export function detectAllergensFromText(text: string): AllergenResult {
  if (!text || text.trim().length === 0) {
    return { hasAllergens: false, allergenList: [], rawMatches: [] }
  }

  const lower = text.toLowerCase()
  const rawMatches: string[] = []
  const allergenNames = new Set<string>()

  for (const keyword of ALLERGEN_KEYWORDS) {
    if (lower.includes(keyword)) {
      rawMatches.push(keyword)
      const name = SPECIFIC_ALLERGENS[keyword]
      if (name) {
        allergenNames.add(name)
      }
    }
  }

  // If we matched generic keywords like "allergy" but no specific allergen,
  // still flag it but with a generic label
  if (rawMatches.length > 0 && allergenNames.size === 0) {
    allergenNames.add('Allergy Alert')
  }

  return {
    hasAllergens: rawMatches.length > 0,
    allergenList: [...allergenNames].sort(),
    rawMatches,
  }
}

/**
 * Detect allergens from a customer's allergen profile.
 * The profile is stored as a jsonb array of strings in customers.allergens.
 */
export function detectAllergensFromProfile(allergens: string[] | null | undefined): AllergenResult {
  if (!allergens || allergens.length === 0) {
    return { hasAllergens: false, allergenList: [], rawMatches: [] }
  }

  // Customer allergen profiles are already named allergens
  const allergenList = allergens.map((a) => {
    // Capitalize first letter
    const trimmed = a.trim()
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()
  })

  return {
    hasAllergens: true,
    allergenList: [...new Set(allergenList)].sort(),
    rawMatches: allergens,
  }
}

interface TicketItemForAllergenCheck {
  special_instructions: string
}

/**
 * Check all items on a ticket for allergen mentions.
 * Combines results from all items' special instructions and an optional customer profile.
 */
export function detectTicketAllergens(
  items: TicketItemForAllergenCheck[],
  customerAllergens?: string[] | null
): AllergenResult {
  const allAllergenNames = new Set<string>()
  const allRawMatches: string[] = []
  let hasAllergens = false

  // Check each item's special instructions
  for (const item of items) {
    const result = detectAllergensFromText(item.special_instructions)
    if (result.hasAllergens) {
      hasAllergens = true
      result.allergenList.forEach((a) => allAllergenNames.add(a))
      allRawMatches.push(...result.rawMatches)
    }
  }

  // Check customer allergen profile
  const profileResult = detectAllergensFromProfile(customerAllergens)
  if (profileResult.hasAllergens) {
    hasAllergens = true
    profileResult.allergenList.forEach((a) => allAllergenNames.add(a))
    allRawMatches.push(...profileResult.rawMatches)
  }

  return {
    hasAllergens,
    allergenList: [...allAllergenNames].sort(),
    rawMatches: [...new Set(allRawMatches)],
  }
}

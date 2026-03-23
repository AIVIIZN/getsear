/**
 * Allergen and dietary tag constants for Sear POS.
 *
 * 14 EU-mandated allergens + 4 US additional allergens = 18 total.
 * 12 dietary tags with standardized abbreviations and colors.
 *
 * All colors chosen for readability on light backgrounds.
 */

// ---------------------------------------------------------------------------
// Allergen mode
// ---------------------------------------------------------------------------

export type AllergenMode = 'CONTAINS' | 'MAY_CONTAIN'

// ---------------------------------------------------------------------------
// Allergen definition
// ---------------------------------------------------------------------------

export interface AllergenDef {
  /** Stable machine-readable identifier (lowercase, no spaces) */
  id: string
  /** Human-readable name */
  name: string
  /** 2-letter abbreviation for badges */
  abbreviation: string
  /** Hex color for badge background */
  color: string
  /** Lucide icon name or emoji for visual identification */
  icon: string
}

/**
 * 14 EU-mandated allergens.
 * Order matches EU FIC Regulation (EU) No 1169/2011 Annex II.
 */
export const EU_ALLERGENS: readonly AllergenDef[] = [
  { id: 'celery', name: 'Celery', abbreviation: 'CE', color: '#6B8E23', icon: 'leaf' },
  { id: 'gluten', name: 'Gluten', abbreviation: 'GL', color: '#D4A017', icon: 'wheat' },
  { id: 'crustaceans', name: 'Crustaceans', abbreviation: 'CR', color: '#E74C3C', icon: 'shell' },
  { id: 'eggs', name: 'Eggs', abbreviation: 'EG', color: '#F39C12', icon: 'egg' },
  { id: 'fish', name: 'Fish', abbreviation: 'FI', color: '#3498DB', icon: 'fish' },
  { id: 'lupin', name: 'Lupin', abbreviation: 'LU', color: '#9B59B6', icon: 'flower-2' },
  { id: 'milk', name: 'Milk', abbreviation: 'ML', color: '#1ABC9C', icon: 'milk' },
  { id: 'molluscs', name: 'Molluscs', abbreviation: 'MO', color: '#2C3E50', icon: 'shell' },
  { id: 'mustard', name: 'Mustard', abbreviation: 'MU', color: '#E67E22', icon: 'droplets' },
  { id: 'tree_nuts', name: 'Tree Nuts', abbreviation: 'TN', color: '#8B4513', icon: 'nut' },
  { id: 'peanuts', name: 'Peanuts', abbreviation: 'PN', color: '#D35400', icon: 'nut' },
  { id: 'sesame', name: 'Sesame', abbreviation: 'SE', color: '#BDC3C7', icon: 'circle-dot' },
  { id: 'soy', name: 'Soy', abbreviation: 'SO', color: '#27AE60', icon: 'bean' },
  { id: 'sulphites', name: 'Sulphites', abbreviation: 'SU', color: '#7F8C8D', icon: 'flask-conical' },
] as const

/**
 * 4 additional US-recognized allergens not in the EU 14.
 */
export const US_ADDITIONAL_ALLERGENS: readonly AllergenDef[] = [
  { id: 'coconut', name: 'Coconut', abbreviation: 'CO', color: '#795548', icon: 'palm-tree' },
  { id: 'shellfish', name: 'Shellfish', abbreviation: 'SF', color: '#C0392B', icon: 'shell' },
  { id: 'corn', name: 'Corn', abbreviation: 'CN', color: '#F1C40F', icon: 'salad' },
  { id: 'latex_fruits', name: 'Latex-reactive Fruits', abbreviation: 'LF', color: '#E91E63', icon: 'apple' },
] as const

/**
 * All 18 allergens combined (EU + US).
 */
export const ALL_ALLERGENS: readonly AllergenDef[] = [
  ...EU_ALLERGENS,
  ...US_ADDITIONAL_ALLERGENS,
] as const

/**
 * Map from allergen ID to definition for fast lookup.
 */
export const ALLERGEN_MAP: ReadonlyMap<string, AllergenDef> = new Map(
  ALL_ALLERGENS.map((a) => [a.id, a])
)

// ---------------------------------------------------------------------------
// Dietary tag definition
// ---------------------------------------------------------------------------

export interface DietaryTagDef {
  /** Stable machine-readable identifier */
  id: string
  /** Human-readable name */
  name: string
  /** Short abbreviation for pills */
  abbreviation: string
  /** Hex background color for pill */
  color: string
}

export const DIETARY_TAGS: readonly DietaryTagDef[] = [
  { id: 'vegetarian', name: 'Vegetarian', abbreviation: 'V', color: '#4CAF50' },
  { id: 'vegan', name: 'Vegan', abbreviation: 'VG', color: '#2E7D32' },
  { id: 'gluten_free', name: 'Gluten-Free', abbreviation: 'GF', color: '#F59E0B' },
  { id: 'dairy_free', name: 'Dairy-Free', abbreviation: 'DF', color: '#06B6D4' },
  { id: 'nut_free', name: 'Nut-Free', abbreviation: 'NF', color: '#8B5CF6' },
  { id: 'keto', name: 'Keto', abbreviation: 'KE', color: '#EF4444' },
  { id: 'paleo', name: 'Paleo', abbreviation: 'PA', color: '#92400E' },
  { id: 'halal', name: 'Halal', abbreviation: 'HA', color: '#10B981' },
  { id: 'kosher', name: 'Kosher', abbreviation: 'KO', color: '#3B82F6' },
  { id: 'low_sodium', name: 'Low-Sodium', abbreviation: 'LS', color: '#6366F1' },
  { id: 'heart_healthy', name: 'Heart-Healthy', abbreviation: 'HH', color: '#EC4899' },
  { id: 'raw', name: 'Raw', abbreviation: 'RW', color: '#14B8A6' },
] as const

export const DIETARY_TAG_MAP: ReadonlyMap<string, DietaryTagDef> = new Map(
  DIETARY_TAGS.map((t) => [t.id, t])
)

// ---------------------------------------------------------------------------
// Ingredient-to-allergen auto-detection keywords
// ---------------------------------------------------------------------------

/**
 * Map from allergen ID to keywords that indicate the ingredient is present.
 * Used by auto-detect in the AllergensTab ingredient list editor.
 * Keywords are lowercase for case-insensitive matching.
 */
export const ALLERGEN_KEYWORDS: ReadonlyMap<string, readonly string[]> = new Map([
  ['celery', ['celery', 'celeriac']],
  ['gluten', ['wheat', 'flour', 'barley', 'rye', 'oats', 'spelt', 'kamut', 'semolina', 'breadcrumbs', 'panko', 'pasta', 'noodles', 'couscous', 'bulgur']],
  ['crustaceans', ['crab', 'lobster', 'shrimp', 'prawn', 'crayfish', 'crawfish', 'langoustine']],
  ['eggs', ['egg', 'eggs', 'mayonnaise', 'mayo', 'meringue', 'aioli']],
  ['fish', ['fish', 'salmon', 'tuna', 'cod', 'haddock', 'anchovy', 'anchovies', 'sardine', 'trout', 'bass', 'halibut', 'swordfish', 'mackerel', 'tilapia', 'mahi', 'snapper']],
  ['lupin', ['lupin', 'lupini']],
  ['milk', ['milk', 'cream', 'butter', 'cheese', 'yogurt', 'whey', 'casein', 'lactose', 'ghee', 'ricotta', 'mozzarella', 'parmesan', 'cheddar', 'brie', 'gouda', 'mascarpone', 'half-and-half']],
  ['molluscs', ['clam', 'clams', 'mussel', 'mussels', 'oyster', 'oysters', 'squid', 'calamari', 'octopus', 'snail', 'escargot', 'scallop', 'scallops']],
  ['mustard', ['mustard', 'dijon']],
  ['tree_nuts', ['almond', 'almonds', 'cashew', 'cashews', 'walnut', 'walnuts', 'pecan', 'pecans', 'pistachio', 'pistachios', 'hazelnut', 'hazelnuts', 'macadamia', 'brazil nut', 'pine nut', 'pine nuts']],
  ['peanuts', ['peanut', 'peanuts', 'peanut butter']],
  ['sesame', ['sesame', 'tahini', 'hummus']],
  ['soy', ['soy', 'soya', 'tofu', 'tempeh', 'edamame', 'miso', 'soy sauce', 'tamari', 'teriyaki']],
  ['sulphites', ['sulphite', 'sulfite', 'wine', 'dried fruit', 'vinegar']],
  ['coconut', ['coconut', 'coconut milk', 'coconut cream', 'coconut oil']],
  ['shellfish', ['shrimp', 'crab', 'lobster', 'crawfish', 'crayfish', 'prawn', 'langoustine', 'clam', 'mussel', 'oyster', 'scallop']],
  ['corn', ['corn', 'cornstarch', 'cornmeal', 'polenta', 'grits', 'corn syrup', 'hominy', 'tortilla']],
  ['latex_fruits', ['banana', 'avocado', 'kiwi', 'chestnut', 'papaya', 'mango', 'passion fruit']],
])

/**
 * Given a raw ingredient list string, auto-detect which allergens are present.
 * Returns set of allergen IDs.
 */
export function detectAllergensFromIngredients(ingredientText: string): Set<string> {
  const lower = ingredientText.toLowerCase()
  const detected = new Set<string>()

  for (const [allergenId, keywords] of ALLERGEN_KEYWORDS) {
    for (const keyword of keywords) {
      // Use word boundary matching to avoid partial matches
      const pattern = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      if (pattern.test(lower)) {
        detected.add(allergenId)
        break
      }
    }
  }

  return detected
}

/**
 * Menu diff computation for franchise centralized menu push.
 */

export interface MenuItemSnapshot {
  id: string
  name: string
  description: string
  price: number // cents
  category: string
  modifiers: Array<{
    id: string
    name: string
    options: Array<{ id: string; name: string; price: number }>
  }>
  is_active: boolean
}

export interface MenuDiffItem {
  item_id: string
  name: string
  change_type: 'added' | 'modified' | 'removed' | 'price_changed'
  old_value?: string
  new_value?: string
  details: string
}

export interface MenuDiffResult {
  total_changes: number
  added: MenuDiffItem[]
  modified: MenuDiffItem[]
  removed: MenuDiffItem[]
  price_changed: MenuDiffItem[]
  affected_locations: number
}

/**
 * Compare corporate menu with location menu.
 */
export function computeMenuDiff(
  corporateMenu: MenuItemSnapshot[],
  locationMenu: MenuItemSnapshot[]
): MenuDiffResult {
  const locationMap = new Map(locationMenu.map((item) => [item.id, item]))
  const corporateMap = new Map(corporateMenu.map((item) => [item.id, item]))

  const added: MenuDiffItem[] = []
  const modified: MenuDiffItem[] = []
  const removed: MenuDiffItem[] = []
  const priceChanged: MenuDiffItem[] = []

  // Find added and modified items
  for (const corpItem of corporateMenu) {
    const locItem = locationMap.get(corpItem.id)

    if (!locItem) {
      added.push({
        item_id: corpItem.id,
        name: corpItem.name,
        change_type: 'added',
        new_value: `$${(corpItem.price / 100).toFixed(2)}`,
        details: `New item: ${corpItem.name} in ${corpItem.category}`,
      })
      continue
    }

    // Check price change
    if (corpItem.price !== locItem.price) {
      priceChanged.push({
        item_id: corpItem.id,
        name: corpItem.name,
        change_type: 'price_changed',
        old_value: `$${(locItem.price / 100).toFixed(2)}`,
        new_value: `$${(corpItem.price / 100).toFixed(2)}`,
        details: `Price: $${(locItem.price / 100).toFixed(2)} -> $${(corpItem.price / 100).toFixed(2)}`,
      })
    }

    // Check other modifications
    const changes: string[] = []
    if (corpItem.name !== locItem.name) changes.push(`Name: "${locItem.name}" -> "${corpItem.name}"`)
    if (corpItem.description !== locItem.description) changes.push('Description updated')
    if (corpItem.category !== locItem.category) changes.push(`Category: ${locItem.category} -> ${corpItem.category}`)
    if (corpItem.is_active !== locItem.is_active) changes.push(corpItem.is_active ? 'Reactivated' : 'Deactivated')

    if (changes.length > 0) {
      modified.push({
        item_id: corpItem.id,
        name: corpItem.name,
        change_type: 'modified',
        details: changes.join('; '),
      })
    }
  }

  // Find removed items
  for (const locItem of locationMenu) {
    if (!corporateMap.has(locItem.id)) {
      removed.push({
        item_id: locItem.id,
        name: locItem.name,
        change_type: 'removed',
        old_value: `$${(locItem.price / 100).toFixed(2)}`,
        details: `Removed: ${locItem.name}`,
      })
    }
  }

  return {
    total_changes: added.length + modified.length + removed.length + priceChanged.length,
    added,
    modified,
    removed,
    price_changed: priceChanged,
    affected_locations: 0, // Set by caller
  }
}

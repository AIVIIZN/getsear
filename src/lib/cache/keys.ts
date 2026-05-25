/**
 * Cache tag generators for Next.js `unstable_cache` + `revalidateTag`.
 *
 * Every tag is org_id-scoped so a cache entry can never bleed across tenants.
 * Use the LIST tag (e.g. `cacheTags.menu(orgId)`) for "all items" queries; use
 * the per-id tag for single-row queries. Mutations should invalidate BOTH the
 * list tag and (when known) the per-id tag.
 *
 * Excluded by design:
 *   - audit log (append-only, dashboard-driven reads)
 *   - anything user/auth-state-specific
 *
 * Task V7.2.2 — see docs/V7_RELIABILITY.md.
 */

export const cacheTags = {
  /** All menu items for an org (list endpoint). */
  menu: (orgId: string) => `menu:${orgId}`,
  /** A single menu item. */
  menuItem: (orgId: string, id: string) => `menu-item:${orgId}:${id}`,
  /** Orders list endpoints for an org. */
  orders: (orgId: string) => `orders:${orgId}`,
  /** Active orders list endpoints for an org. */
  activeOrders: (orgId: string) => `orders-active:${orgId}`,
  /** A single order with nested items/modifiers. */
  order: (orgId: string, id: string) => `order:${orgId}:${id}`,
  /** All staff members for an org (list endpoint). */
  staff: (orgId: string) => `staff:${orgId}`,
  /** A single staff member. */
  staffMember: (orgId: string, id: string) => `staff-member:${orgId}:${id}`,
} as const

export type CacheTag = ReturnType<(typeof cacheTags)[keyof typeof cacheTags]>

/**
 * Default Next.js 16 cacheLife profile used by `revalidateTag` calls in this
 * codebase. `'max'` gives stale-while-revalidate semantics — readers see stale
 * data while a fresh value is computed in the background. This matches the
 * SWR pattern called for in V7.2.2.
 *
 * If you ever need an immediate hard expiration, pass `{ expire: 0 }` directly
 * instead of importing this constant.
 */
export const CACHE_REVALIDATE_PROFILE = 'max' as const

export function orderCacheTags(orgId: string, orderId?: string) {
  return orderId
    ? [cacheTags.orders(orgId), cacheTags.activeOrders(orgId), cacheTags.order(orgId, orderId)]
    : [cacheTags.orders(orgId), cacheTags.activeOrders(orgId)]
}

/**
 * KDS aging color helpers (V6 batch 6.2.2).
 *
 * Drives the per-ticket border + glow via the `--ticket-age-color` CSS custom
 * property — set inline on each KdsTicket card. The card uses the
 * `kds-aging-border` utility (defined in src/styles/tokens.css) which maps
 * --ticket-age-color → border-color + box-shadow.
 *
 * Aging categories come from the server (ticket.age_category in the KDS store)
 * and are bucketed into:
 *   fresh    : < 5 min  → green border (--color-kds-aging-fresh)
 *   aging    : 5–7.5    → amber       (--color-kds-aging-aging)
 *   late     : 7.5–10   → orange      (--color-kds-aging-late)
 *   critical : > 10 min → red         (--color-kds-aging-critical)
 *
 * Smooth interpolation uses CSS color-mix between adjacent buckets so the
 * border eases through the gradient without JS recompute on every render —
 * the bucket that was true at server-render time is good enough.
 */

export type AgingCategory = 'fresh' | 'aging' | 'late' | 'critical'

/** Token (or color-mix) string used as `--ticket-age-color` on a ticket card. */
export function getTicketAgingColor(category: AgingCategory): string {
  switch (category) {
    case 'fresh':
      return 'var(--color-kds-aging-fresh)'
    case 'aging':
      // 50% mix of green→amber gives a "warming" hue at the start of the bucket.
      return 'color-mix(in srgb, var(--color-kds-aging-fresh) 30%, var(--color-kds-aging-aging) 70%)'
    case 'late':
      return 'color-mix(in srgb, var(--color-kds-aging-aging) 30%, var(--color-kds-aging-late) 70%)'
    case 'critical':
      return 'var(--color-kds-aging-critical)'
  }
}

/** Per-ticket card background tint (deeper for hotter buckets). */
export function getAgingBackground(category: AgingCategory): string {
  switch (category) {
    case 'fresh':
      return 'var(--color-kds-ticket-bg)'
    case 'aging':
      return 'var(--color-kds-ticket-bg-aging)'
    case 'late':
      return 'var(--color-kds-ticket-bg-late)'
    case 'critical':
      return 'var(--color-kds-ticket-bg-critical)'
  }
}

/** Per-item left-border color for individual line aging. */
export function getItemAgingBorder(ageCategory: string | undefined): string {
  switch (ageCategory) {
    case 'aging':
      return 'var(--color-kds-aging-aging)'
    case 'late':
      return 'var(--color-kds-aging-late)'
    case 'critical':
      return 'var(--color-kds-aging-critical)'
    default:
      return 'transparent'
  }
}

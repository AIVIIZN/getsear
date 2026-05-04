"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/*
 * Sear POS UI v2 — Topbar
 * Spec: docs/design/UI_V2_COMPONENT_SPEC.md (universal rules) +
 *       build-pipeline/versions/V6_VISUAL.md → 6.1.5 Navigation
 *
 * 56pt height via var(--topbar-height) (= var(--space-14)).
 * Safe-area-inset-top aware: padding-top respects iPad notch / status bar so the
 * 56pt content row sits BELOW the inset. Total visual height grows by safe inset.
 *
 * Three slots: leading (back/menu), center (title or breadcrumbs), trailing (actions).
 */

export interface TopbarProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  /** Left-aligned slot — back button, menu toggle, or brand. */
  leading?: React.ReactNode
  /** Center slot — page title node, breadcrumbs, or search. */
  title?: React.ReactNode
  /** Right-aligned slot — action buttons, profile, etc. */
  trailing?: React.ReactNode
  /** Sticky to top of scroll container. Defaults to true. */
  sticky?: boolean
  /** Render border-bottom. Defaults to true. */
  bordered?: boolean
}

const Topbar = React.forwardRef<HTMLElement, TopbarProps>(function Topbar(
  {
    className,
    leading,
    title,
    trailing,
    sticky = true,
    bordered = true,
    children,
    ...props
  },
  ref,
) {
  return (
    <header
      ref={ref}
      data-component="ui-v2-topbar"
      className={cn(
        "w-full bg-[var(--color-bg)]",
        "z-[var(--z-sticky)]",
        sticky && "sticky top-0",
        bordered && "border-b border-[var(--color-border)]",
        // Safe-area-inset-top: push content below status bar / notch on iPad
        "pt-[env(safe-area-inset-top,0px)]",
        // Horizontal safe areas (iPad landscape rotation)
        "pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "flex items-center gap-[var(--space-3)]",
          "h-[var(--topbar-height)]",
          "px-[var(--space-4)]",
        )}
      >
        {leading != null && (
          <div className="flex items-center gap-[var(--space-2)] shrink-0">{leading}</div>
        )}
        <div className="flex flex-1 items-center min-w-0">
          {title != null ? (
            <div
              className={cn(
                "truncate",
                "text-[var(--type-headline-size)] font-[var(--weight-semibold)]",
                "leading-[var(--type-line-height-tight)]",
                "text-[var(--color-text)]",
              )}
            >
              {title}
            </div>
          ) : (
            children
          )}
        </div>
        {trailing != null && (
          <div className="flex items-center gap-[var(--space-2)] shrink-0">
            {trailing}
          </div>
        )}
      </div>
    </header>
  )
})

export { Topbar }
export default Topbar

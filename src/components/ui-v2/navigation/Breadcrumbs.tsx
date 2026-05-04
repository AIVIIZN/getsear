"use client"

import * as React from "react"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

/*
 * Sear POS UI v2 — Breadcrumbs
 * Spec: docs/design/UI_V2_COMPONENT_SPEC.md (universal rules) +
 *       build-pipeline/versions/V6_VISUAL.md → 6.1.5 Navigation
 *
 * Single horizontal trail; final crumb is the current page (non-interactive).
 * Tappable crumbs honor the 44pt touch-target rule via .touch-target on the row;
 * the visible chip stays compact so the layout doesn't balloon.
 */

export interface BreadcrumbItem {
  label: string
  /** When omitted, the crumb renders as a non-interactive label (current page). */
  href?: string
  /** Optional click handler (used when not navigating with href). */
  onClick?: () => void
}

export interface BreadcrumbsProps extends React.HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[]
  /** Custom separator node. Defaults to a chevron-right icon. */
  separator?: React.ReactNode
}

const Breadcrumbs = React.forwardRef<HTMLElement, BreadcrumbsProps>(
  function Breadcrumbs({ className, items, separator, ...props }, ref) {
    const sep = separator ?? (
      <ChevronRight
        aria-hidden="true"
        className="size-[14px] text-[var(--color-text-subtle)]"
      />
    )

    return (
      <nav
        ref={ref}
        aria-label="Breadcrumb"
        data-component="ui-v2-breadcrumbs"
        className={cn("w-full", className)}
        {...props}
      >
        <ol className="flex flex-wrap items-center gap-[var(--space-1)]">
          {items.map((item, idx) => {
            const isLast = idx === items.length - 1
            const isInteractive = !isLast && (Boolean(item.href) || Boolean(item.onClick))

            return (
              <li
                key={`${item.label}-${idx}`}
                className="flex items-center gap-[var(--space-1)]"
              >
                {isInteractive ? (
                  <a
                    href={item.href}
                    onClick={(event) => {
                      if (item.onClick) {
                        event.preventDefault()
                        item.onClick()
                      }
                    }}
                    className={cn(
                      "btn-press touch-target",
                      "inline-flex items-center",
                      "px-[var(--space-2)] py-[var(--space-1)]",
                      "rounded-[var(--radius-sm)]",
                      "text-[var(--type-subhead-size)] font-[var(--weight-medium)]",
                      "text-[var(--color-text-muted)]",
                      "transition-[background-color,color] duration-[var(--duration-quick)] ease-[var(--ease-out)]",
                      "hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]",
                      "outline-none focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] focus-visible:outline-offset-2",
                    )}
                  >
                    {item.label}
                  </a>
                ) : (
                  <span
                    aria-current={isLast ? "page" : undefined}
                    className={cn(
                      "inline-flex items-center",
                      "px-[var(--space-2)] py-[var(--space-1)]",
                      "text-[var(--type-subhead-size)]",
                      isLast
                        ? "font-[var(--weight-semibold)] text-[var(--color-text)]"
                        : "font-[var(--weight-medium)] text-[var(--color-text-muted)]",
                    )}
                  >
                    {item.label}
                  </span>
                )}
                {!isLast && (
                  <span aria-hidden="true" className="flex items-center">
                    {sep}
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      </nav>
    )
  },
)

export { Breadcrumbs }
export default Breadcrumbs

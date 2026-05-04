"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/*
 * Sear POS UI v2 — Sidebar
 * Spec: docs/design/UI_V2_COMPONENT_SPEC.md (universal rules) +
 *       build-pipeline/versions/V6_VISUAL.md → 6.1.5 Navigation
 *
 * Light Apple iPadOS sidebar (#F2F2F7 via var(--color-sidebar)).
 * 240pt width via var(--sidebar-width).
 * Active item gets var(--color-sidebar-active) tint (12% primary).
 * Sub-parts: SidebarSection (heading group) + SidebarItem (link/button row).
 *
 * NEVER regress to a dark sidebar — Apple HIG iPadOS standard, locked by Ian feedback.
 */

export interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  /** Optional brand/logo block at the top. */
  header?: React.ReactNode
  /** Optional footer block (user, settings, etc.). */
  footer?: React.ReactNode
}

const Sidebar = React.forwardRef<HTMLElement, SidebarProps>(function Sidebar(
  { className, header, footer, children, ...props },
  ref,
) {
  return (
    <aside
      ref={ref}
      data-component="ui-v2-sidebar"
      className={cn(
        "flex h-full flex-col",
        "w-[var(--sidebar-width)] shrink-0",
        "bg-[var(--color-sidebar)]",
        "border-r border-[var(--color-border)]",
        // iPad safe-area: top inset preserved via topbar; left inset on landscape rotation
        "pl-[env(safe-area-inset-left,0px)]",
        // Reserve bottom safe-area for iPad in portrait/landscape with home indicator
        "pb-[env(safe-area-inset-bottom,0px)]",
        className,
      )}
      {...props}
    >
      {header != null && (
        <div
          className={cn(
            "flex items-center px-[var(--space-4)]",
            "h-[var(--topbar-height)]",
            "border-b border-[var(--color-border)]",
          )}
        >
          {header}
        </div>
      )}
      <nav
        aria-label="Primary"
        className={cn(
          "flex-1 overflow-y-auto",
          "px-[var(--space-2)] py-[var(--space-3)]",
          "flex flex-col gap-[var(--space-4)]",
        )}
      >
        {children}
      </nav>
      {footer != null && (
        <div
          className={cn(
            "border-t border-[var(--color-border)]",
            "px-[var(--space-3)] py-[var(--space-3)]",
          )}
        >
          {footer}
        </div>
      )}
    </aside>
  )
})

export interface SidebarSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional uppercase heading shown above the items. */
  label?: string
}

const SidebarSection = React.forwardRef<HTMLDivElement, SidebarSectionProps>(
  function SidebarSection({ className, label, children, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn("flex flex-col gap-[var(--space-1)]", className)}
        {...props}
      >
        {label != null && (
          <div
            className={cn(
              "px-[var(--space-3)] pb-[var(--space-1)] pt-[var(--space-2)]",
              "text-[var(--type-caption-1-size)] font-[var(--weight-semibold)]",
              "uppercase tracking-wider",
              "text-[var(--color-text-subtle)]",
              "select-none",
            )}
          >
            {label}
          </div>
        )}
        {children}
      </div>
    )
  },
)

export interface SidebarItemProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color"> {
  /** Active/selected route. */
  active?: boolean
  /** Leading icon node (lucide-react sized 18-20). */
  icon?: React.ReactNode
  /** Optional trailing slot — badge, count, chevron. */
  trailing?: React.ReactNode
  /** Render as a different element (e.g., next/link). Defaults to button. */
  asChild?: boolean
}

const SidebarItem = React.forwardRef<HTMLButtonElement, SidebarItemProps>(
  function SidebarItem(
    { className, active = false, icon, trailing, type = "button", children, ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        data-active={active || undefined}
        aria-current={active ? "page" : undefined}
        className={cn(
          "btn-press touch-target",
          "group relative flex w-full items-center gap-[var(--space-3)]",
          "px-[var(--space-3)] py-[var(--space-2)]",
          "rounded-[var(--radius-sm)]",
          "text-left",
          "text-[var(--type-subhead-size)] font-[var(--weight-medium)]",
          "leading-[var(--type-line-height-tight)]",
          "text-[var(--color-text)]",
          "transition-[background-color,color] duration-[var(--duration-quick)] ease-[var(--ease-out)]",
          "outline-none focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] focus-visible:outline-offset-2",
          // Hover (non-active)
          !active && "hover:bg-[var(--color-surface-hover)]",
          // Active state — Apple-style tinted pill
          active &&
            "bg-[var(--color-sidebar-active)] text-[var(--color-primary)] font-[var(--weight-semibold)]",
          // Disabled token pattern
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none",
          // Icon defaults
          "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-[18px]",
          className,
        )}
        {...props}
      >
        {icon != null && <span className="flex items-center">{icon}</span>}
        <span className="flex-1 truncate">{children}</span>
        {trailing != null && (
          <span className="flex items-center text-[var(--color-text-muted)]">
            {trailing}
          </span>
        )}
      </button>
    )
  },
)

export { Sidebar, SidebarSection, SidebarItem }
export default Sidebar

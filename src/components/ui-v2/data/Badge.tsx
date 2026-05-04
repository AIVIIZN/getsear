"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/*
 * Sear POS UI v2 — Badge
 * Spec: docs/design/UI_V2_COMPONENT_SPEC.md universal rules + V6_VISUAL 6.1.4
 *
 * Variants: default, primary, success, warning, danger, info
 * Sizes:    sm, md
 *
 * All colors via var(--color-*) tokens. Status variants use the *-bg + base
 * color pair so they read on the light surface without losing legibility.
 */

const badgeVariants = cva(
  cn(
    "inline-flex items-center justify-center gap-[var(--space-1)] whitespace-nowrap select-none",
    "font-[var(--font-system)] font-[var(--weight-medium)] leading-[var(--type-line-height-tight)]",
    "rounded-[var(--radius-xs)]",
    "border border-transparent",
  ),
  {
    variants: {
      variant: {
        default: cn(
          "bg-[var(--color-bg-muted)] text-[var(--color-text)]",
          "border-[var(--color-border)]",
        ),
        primary: cn(
          "bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]",
          "text-[var(--color-primary)]",
        ),
        success: cn(
          "bg-[var(--color-success-bg)]",
          "text-[var(--color-success)]",
        ),
        warning: cn(
          "bg-[var(--color-warning-bg)]",
          "text-[var(--color-warning)]",
        ),
        danger: cn(
          "bg-[var(--color-danger-bg)]",
          "text-[var(--color-danger)]",
        ),
        info: cn(
          "bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)]",
          "text-[var(--color-primary)]",
        ),
      },
      size: {
        sm: "h-[18px] px-[var(--space-2)] text-[var(--type-caption-2-size)]",
        md: "h-[22px] px-[var(--space-2)] text-[var(--type-caption-1-size)]",
      },
      shape: {
        rounded: "rounded-[var(--radius-xs)]",
        pill: "rounded-[var(--radius-pill)] px-[var(--space-3)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
      shape: "rounded",
    },
  },
)

type BadgeVariantProps = VariantProps<typeof badgeVariants>

export interface BadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "color">,
    BadgeVariantProps {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  function Badge({ className, variant, size, shape, ...props }, ref) {
    return (
      <span
        ref={ref}
        data-variant={variant ?? "default"}
        data-size={size ?? "md"}
        className={cn(badgeVariants({ variant, size, shape }), className)}
        {...props}
      />
    )
  },
)

export { Badge, badgeVariants }
export default Badge

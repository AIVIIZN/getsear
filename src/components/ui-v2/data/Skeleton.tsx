"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/*
 * Sear POS UI v2 — Skeleton
 * Spec: docs/design/UI_V2_COMPONENT_SPEC.md universal rules + V6_VISUAL 6.1.4
 *
 * 5 explicit shape variants matching the layouts they hide:
 *   - text       single text line (default)
 *   - card       card-shaped block (image + 2 lines)
 *   - table-row  full-width row with cells
 *   - avatar     circular avatar
 *   - chart      large block (bar/area chart placeholder)
 *
 * Uses .skeleton utility class from tokens.css for the shimmer animation;
 * never re-implement the keyframes here.
 */

export type SkeletonVariant = "text" | "card" | "table-row" | "avatar" | "chart"

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant
  /** For text variant: number of lines to render. Defaults to 1. */
  lines?: number
}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  function Skeleton({ variant = "text", lines = 1, className, ...props }, ref) {
    if (variant === "text") {
      return (
        <div
          ref={ref}
          data-variant="text"
          className={cn("flex flex-col gap-[var(--space-2)]", className)}
          aria-hidden="true"
          {...props}
        >
          {Array.from({ length: Math.max(1, lines) }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "skeleton h-[var(--type-body-size)]",
                i === lines - 1 && lines > 1 ? "w-3/5" : "w-full",
              )}
            />
          ))}
        </div>
      )
    }

    if (variant === "avatar") {
      return (
        <div
          ref={ref}
          data-variant="avatar"
          aria-hidden="true"
          className={cn(
            "skeleton h-[40px] w-[40px] rounded-[var(--radius-circle)]",
            className,
          )}
          {...props}
        />
      )
    }

    if (variant === "card") {
      return (
        <div
          ref={ref}
          data-variant="card"
          aria-hidden="true"
          className={cn(
            "flex flex-col gap-[var(--space-3)] p-[var(--space-4)]",
            "rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]",
            className,
          )}
          {...props}
        >
          <div className="skeleton h-[140px] w-full rounded-[var(--radius-sm)]" />
          <div className="skeleton h-[var(--type-headline-size)] w-3/4" />
          <div className="skeleton h-[var(--type-footnote-size)] w-1/2" />
        </div>
      )
    }

    if (variant === "table-row") {
      return (
        <div
          ref={ref}
          data-variant="table-row"
          aria-hidden="true"
          className={cn(
            "flex items-center gap-[var(--space-4)] px-[var(--space-4)] py-[var(--space-3)]",
            "border-b border-[var(--color-border)]",
            className,
          )}
          {...props}
        >
          <div className="skeleton h-[var(--type-body-size)] w-1/4" />
          <div className="skeleton h-[var(--type-body-size)] w-1/3" />
          <div className="skeleton h-[var(--type-body-size)] w-1/6" />
          <div className="skeleton ml-auto h-[var(--type-body-size)] w-[60px]" />
        </div>
      )
    }

    // chart
    return (
      <div
        ref={ref}
        data-variant="chart"
        aria-hidden="true"
        className={cn(
          "skeleton w-full h-[260px] rounded-[var(--radius-md)]",
          className,
        )}
        {...props}
      />
    )
  },
)

export { Skeleton }
export default Skeleton

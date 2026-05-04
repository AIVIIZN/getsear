"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/*
 * Sear POS UI v2 — Stat
 * Spec: docs/design/UI_V2_COMPONENT_SPEC.md universal rules + V6_VISUAL 6.1.4
 *
 * Anatomy: label (small uppercase) + value (large) + optional delta indicator.
 * Delta direction colors:
 *   - up      success (green)
 *   - down    danger  (red)
 *   - flat    text-muted
 *
 * Caller decides what is "good": e.g. "refunds down" should still be marked
 * `direction="down"` because the visual encoding is purely about magnitude.
 * For inverted semantics, swap the variant via `intent` prop.
 */

export type StatDirection = "up" | "down" | "flat"
export type StatIntent = "auto" | "positive" | "negative"

export interface StatDelta {
  value: string
  direction?: StatDirection
  /** auto: up=success, down=danger; positive: always success; negative: always danger. */
  intent?: StatIntent
  label?: string
}

export interface StatProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  value: React.ReactNode
  delta?: StatDelta
}

function deltaColor(delta: StatDelta): string {
  const intent = delta.intent ?? "auto"
  const direction = delta.direction ?? "flat"
  if (intent === "positive") return "text-[var(--color-success)]"
  if (intent === "negative") return "text-[var(--color-danger)]"
  if (direction === "up") return "text-[var(--color-success)]"
  if (direction === "down") return "text-[var(--color-danger)]"
  return "text-[var(--color-text-muted)]"
}

function DeltaArrow({ direction }: { direction: StatDirection }) {
  if (direction === "flat") {
    return (
      <svg viewBox="0 0 12 12" className="h-[10px] w-[10px]" aria-hidden="true">
        <path
          d="M2 6h8"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  const isUp = direction === "up"
  return (
    <svg viewBox="0 0 12 12" className="h-[10px] w-[10px]" aria-hidden="true">
      <path
        d={isUp ? "M6 2 L10 8 L2 8 Z" : "M6 10 L10 4 L2 4 Z"}
        fill="currentColor"
      />
    </svg>
  )
}

const Stat = React.forwardRef<HTMLDivElement, StatProps>(
  function Stat({ className, label, value, delta, ...props }, ref) {
    const direction = delta?.direction ?? "flat"
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col gap-[var(--space-1)]",
          className,
        )}
        {...props}
      >
        <span
          className={cn(
            "text-[var(--type-caption-1-size)] font-[var(--weight-medium)]",
            "uppercase tracking-wide text-[var(--color-text-muted)]",
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "text-[var(--type-title-1-size)] font-[var(--weight-semibold)]",
            "leading-[var(--type-line-height-tight)] text-[var(--color-text)]",
          )}
        >
          {value}
        </span>
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-[var(--space-1)]",
              "text-[var(--type-footnote-size)] font-[var(--weight-medium)]",
              deltaColor(delta),
            )}
          >
            <DeltaArrow direction={direction} />
            <span>{delta.value}</span>
            {delta.label && (
              <span className="text-[var(--color-text-muted)] font-[var(--weight-regular)]">
                {delta.label}
              </span>
            )}
          </span>
        )}
      </div>
    )
  },
)

export { Stat }
export default Stat

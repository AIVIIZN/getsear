"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/*
 * Sear POS UI v2 — Progress
 * Spec: docs/design/UI_V2_COMPONENT_SPEC.md universal rules + V6_VISUAL 6.1.4
 *
 * Two variants: linear (bar) + circular.
 * Color tones: primary (default), success, warning, danger.
 * Sizes:
 *   linear   sm=4px / md=6px / lg=10px height
 *   circular sm=24px / md=40px / lg=64px diameter
 *
 * Indeterminate state: omit `value` (or pass null) — bar gets sliding stripe;
 * circular gets a slow rotation.
 */

export type ProgressTone = "primary" | "success" | "warning" | "danger"
export type ProgressSize = "sm" | "md" | "lg"

const toneClass: Record<ProgressTone, string> = {
  primary: "bg-[var(--color-primary)]",
  success: "bg-[var(--color-success-strong)]",
  warning: "bg-[var(--color-warning-strong)]",
  danger: "bg-[var(--color-danger-strong)]",
}

const toneStroke: Record<ProgressTone, string> = {
  primary: "stroke-[var(--color-primary)]",
  success: "stroke-[var(--color-success-strong)]",
  warning: "stroke-[var(--color-warning-strong)]",
  danger: "stroke-[var(--color-danger-strong)]",
}

const linearHeight: Record<ProgressSize, string> = {
  sm: "h-[4px]",
  md: "h-[6px]",
  lg: "h-[10px]",
}

const circularDiameter: Record<ProgressSize, number> = {
  sm: 24,
  md: 40,
  lg: 64,
}

const circularStroke: Record<ProgressSize, number> = {
  sm: 3,
  md: 4,
  lg: 6,
}

export interface ProgressProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** 0–100, or null/undefined for indeterminate. */
  value?: number | null
  variant?: "linear" | "circular"
  tone?: ProgressTone
  size?: ProgressSize
  label?: string
}

function clampPct(v: number): number {
  if (Number.isNaN(v)) return 0
  if (v < 0) return 0
  if (v > 100) return 100
  return v
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  function Progress(
    {
      className,
      value,
      variant = "linear",
      tone = "primary",
      size = "md",
      label,
      ...props
    },
    ref,
  ) {
    const indeterminate = value === undefined || value === null
    const pct = indeterminate ? 0 : clampPct(value)

    if (variant === "circular") {
      const d = circularDiameter[size]
      const sw = circularStroke[size]
      const r = (d - sw) / 2
      const c = 2 * Math.PI * r
      const offset = indeterminate ? c * 0.75 : c * (1 - pct / 100)

      return (
        <div
          ref={ref}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={indeterminate ? undefined : pct}
          aria-label={label}
          data-indeterminate={indeterminate || undefined}
          className={cn(
            "inline-flex items-center justify-center",
            indeterminate && "animate-spin",
            className,
          )}
          {...props}
        >
          <svg width={d} height={d} viewBox={`0 0 ${d} ${d}`}>
            <circle
              cx={d / 2}
              cy={d / 2}
              r={r}
              fill="none"
              strokeWidth={sw}
              className="stroke-[var(--color-bg-muted)]"
            />
            <circle
              cx={d / 2}
              cy={d / 2}
              r={r}
              fill="none"
              strokeWidth={sw}
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={offset}
              transform={`rotate(-90 ${d / 2} ${d / 2})`}
              style={{
                transition: "stroke-dashoffset var(--duration-base) var(--ease-out)",
              }}
              className={toneStroke[tone]}
            />
          </svg>
        </div>
      )
    }

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : pct}
        aria-label={label}
        data-indeterminate={indeterminate || undefined}
        className={cn(
          "relative w-full overflow-hidden rounded-[var(--radius-pill)]",
          "bg-[var(--color-bg-muted)]",
          linearHeight[size],
          className,
        )}
        {...props}
      >
        {indeterminate ? (
          <div
            className={cn(
              "absolute inset-y-0 w-1/3 rounded-[var(--radius-pill)]",
              toneClass[tone],
            )}
            style={{
              animation: "skeleton-shimmer 1.4s linear infinite",
            }}
          />
        ) : (
          <div
            className={cn(
              "h-full rounded-[var(--radius-pill)]",
              toneClass[tone],
            )}
            style={{
              width: `${pct}%`,
              transition:
                "width var(--duration-base) var(--ease-out)",
            }}
          />
        )}
      </div>
    )
  },
)

export { Progress }
export default Progress

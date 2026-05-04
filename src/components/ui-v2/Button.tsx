"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/*
 * Sear POS UI v2 — Button
 * Spec: docs/design/UI_V2_COMPONENT_SPEC.md → "Button"
 *
 * Variants: primary, secondary, ghost, destructive
 * Sizes:    sm (32pt back-office), md (40pt back-office), lg (44pt POS), xl (52pt CTA)
 * States:   default / hover / active / focus-visible / disabled / loading
 *
 * All colors/spaces/radii via var(--*) tokens. No hardcoded hex.
 */

const buttonVariants = cva(
  cn(
    // base layout
    "btn-press inline-flex items-center justify-center gap-[var(--space-2)] whitespace-nowrap select-none",
    "rounded-[var(--radius-sm)]",
    "font-[var(--font-system)]",
    "transition-[background-color,color,border-color,box-shadow,opacity] duration-[var(--duration-quick)] ease-[var(--ease-out)]",
    // focus-visible ring (token-based)
    "outline-none focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] focus-visible:outline-offset-2",
    // disabled
    "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none",
    // svg icon defaults
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ),
  {
    variants: {
      variant: {
        primary: cn(
          "bg-[var(--color-primary)] text-[var(--color-text-on-primary)]",
          "hover:bg-[var(--color-primary-hover)]",
          "active:bg-[var(--color-primary-active)]",
        ),
        secondary: cn(
          "bg-[var(--color-surface)] text-[var(--color-text)]",
          "border border-[var(--color-border-strong)]",
          "hover:bg-[var(--color-surface-hover)]",
          "active:bg-[var(--color-surface-active)]",
        ),
        ghost: cn(
          "bg-transparent text-[var(--color-text)]",
          "hover:bg-[var(--color-surface-hover)]",
          "active:bg-[var(--color-surface-active)]",
        ),
        destructive: cn(
          "bg-[var(--color-danger-strong)] text-[var(--color-primary-fg)]",
          "hover:bg-[var(--color-danger)]",
          "active:bg-[var(--color-danger)]",
        ),
      },
      size: {
        // 32pt — back-office only, NEVER POS (rule per spec)
        sm: cn(
          "h-[32px] px-[var(--space-3)]",
          "text-[var(--type-footnote-size)] leading-[var(--type-line-height-tight)] font-[var(--weight-medium)]",
          "[&_svg]:size-[14px]",
        ),
        // 40pt — back-office default
        md: cn(
          "h-[40px] px-[var(--space-4)]",
          "text-[var(--type-subhead-size)] leading-[var(--type-line-height-tight)] font-[var(--weight-medium)]",
          "[&_svg]:size-[16px]",
        ),
        // 44pt — POS default + Apple HIG min touch
        lg: cn(
          "h-[44px] px-[var(--space-5)] touch-target",
          "text-[var(--type-callout-size)] leading-[var(--type-line-height-tight)] font-[var(--weight-semibold)]",
          "[&_svg]:size-[18px]",
        ),
        // 52pt — primary CTAs on POS
        xl: cn(
          "h-[52px] px-[var(--space-6)] touch-target",
          "text-[var(--type-body-size)] leading-[var(--type-line-height-tight)] font-[var(--weight-semibold)]",
          "[&_svg]:size-[20px]",
        ),
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "lg",
    },
  },
)

type ButtonVariantProps = VariantProps<typeof buttonVariants>

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color">,
    ButtonVariantProps {
  /** Show spinner; button becomes disabled while label remains visible. */
  loading?: boolean
  /** Optional leading icon (hidden while loading; spinner takes its slot). */
  leadingIcon?: React.ReactNode
  /** Optional trailing icon. */
  trailingIcon?: React.ReactNode
}

/* Inline spinner — currentColor matches whatever variant text color is in play. */
function Spinner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("animate-spin", className)}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <path
        d="M21 12a9 9 0 0 1-9 9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant,
      size,
      loading = false,
      leadingIcon,
      trailingIcon,
      disabled,
      type = "button",
      children,
      ...props
    },
    ref,
  ) {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        data-loading={loading || undefined}
        data-variant={variant ?? "primary"}
        data-size={size ?? "lg"}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {loading ? <Spinner /> : leadingIcon}
        {children != null && <span>{children}</span>}
        {!loading && trailingIcon}
      </button>
    )
  },
)

export { Button, buttonVariants }
export default Button

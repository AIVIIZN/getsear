"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type CardVariant = "flat" | "elevated" | "interactive"
type CardPadding = "compact" | "default" | "spacious"

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  padding?: CardPadding
  asChild?: boolean
}

const variantClass: Record<CardVariant, string> = {
  flat: "border border-[color:var(--color-border)] shadow-[var(--shadow-flat)]",
  elevated: "border border-transparent shadow-[var(--shadow-low)]",
  interactive:
    "btn-press cursor-pointer border border-transparent shadow-[var(--shadow-low)] hover:bg-[color:var(--color-surface-hover)] hover:shadow-[var(--shadow-mid)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-border-focus)]",
}

const paddingClass: Record<CardPadding, string> = {
  compact: "p-[var(--space-4)]",
  default: "p-[var(--space-6)]",
  spacious: "p-[var(--space-8)]",
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, variant = "flat", padding = "default", ...props },
  ref,
) {
  const interactive = variant === "interactive"
  return (
    <div
      ref={ref}
      data-slot="card"
      data-variant={variant}
      data-padding={padding}
      tabIndex={interactive ? (props.tabIndex ?? 0) : props.tabIndex}
      role={interactive ? (props.role ?? "button") : props.role}
      className={cn(
        "flex flex-col gap-[var(--space-4)] rounded-[var(--radius-md)] bg-[color:var(--color-surface)] text-[color:var(--color-text)]",
        "transition-[background-color,box-shadow,transform] duration-[var(--duration-quick)] ease-[var(--ease-out)]",
        paddingClass[padding],
        variantClass[variant],
        className,
      )}
      {...props}
    />
  )
})

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="card-header"
        className={cn("flex flex-col gap-[var(--space-1)]", className)}
        {...props}
      />
    )
  },
)

const CardBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardBody({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="card-body"
        className={cn("flex flex-col gap-[var(--space-3)]", className)}
        {...props}
      />
    )
  },
)

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardFooter({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="card-footer"
        className={cn(
          "mt-[var(--space-2)] flex items-center justify-end gap-[var(--space-2)]",
          className,
        )}
        {...props}
      />
    )
  },
)

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  function CardTitle({ className, ...props }, ref) {
    return (
      <h3
        ref={ref}
        data-slot="card-title"
        className={cn(
          "text-[length:var(--type-headline-size)] font-[number:var(--weight-semibold)] leading-[var(--type-line-height-snug)] text-[color:var(--color-text)]",
          className,
        )}
        {...props}
      />
    )
  },
)

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  function CardDescription({ className, ...props }, ref) {
    return (
      <p
        ref={ref}
        data-slot="card-description"
        className={cn(
          "text-[length:var(--type-subhead-size)] leading-[var(--type-line-height-normal)] text-[color:var(--color-text-muted)]",
          className,
        )}
        {...props}
      />
    )
  },
)

export { Card, CardHeader, CardBody, CardFooter, CardTitle, CardDescription }
export default Card

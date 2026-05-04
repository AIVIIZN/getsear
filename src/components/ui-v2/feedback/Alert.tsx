"use client"

import * as React from "react"
import { CheckCircle2, Info, AlertTriangle, XCircle } from "lucide-react"

import { cn } from "@/lib/utils"

export type AlertVariant = "success" | "info" | "warning" | "danger"

export interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  variant?: AlertVariant
  title?: React.ReactNode
  icon?: React.ReactNode
}

const variantStyles: Record<
  AlertVariant,
  {
    container: string
    icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
    iconClass: string
    titleClass: string
    role: "status" | "alert"
  }
> = {
  success: {
    container:
      "bg-[color:var(--color-success-bg)] border-[color:var(--color-success-strong)]/30 text-[color:var(--color-text)]",
    icon: CheckCircle2,
    iconClass: "text-[color:var(--color-success-strong)]",
    titleClass: "text-[color:var(--color-success)]",
    role: "status",
  },
  info: {
    container:
      "bg-[color:var(--color-bg-subtle)] border-[color:var(--color-primary)]/25 text-[color:var(--color-text)]",
    icon: Info,
    iconClass: "text-[color:var(--color-primary)]",
    titleClass: "text-[color:var(--color-primary)]",
    role: "status",
  },
  warning: {
    container:
      "bg-[color:var(--color-warning-bg)] border-[color:var(--color-warning-strong)]/30 text-[color:var(--color-text)]",
    icon: AlertTriangle,
    iconClass: "text-[color:var(--color-warning-strong)]",
    titleClass: "text-[color:var(--color-warning)]",
    role: "alert",
  },
  danger: {
    container:
      "bg-[color:var(--color-danger-bg)] border-[color:var(--color-danger-strong)]/30 text-[color:var(--color-text)]",
    icon: XCircle,
    iconClass: "text-[color:var(--color-danger-strong)]",
    titleClass: "text-[color:var(--color-danger)]",
    role: "alert",
  },
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(
  { variant = "info", title, icon, className, children, ...props },
  ref,
) {
  const styles = variantStyles[variant]
  const VariantIcon = styles.icon

  return (
    <div
      ref={ref}
      role={styles.role}
      data-slot="alert"
      data-variant={variant}
      className={cn(
        "flex w-full items-start gap-[var(--space-3)]",
        "rounded-[var(--radius-md)] border p-[var(--space-4)]",
        styles.container,
        className,
      )}
      {...props}
    >
      <span className={cn("mt-[2px] flex h-5 w-5 shrink-0 items-center justify-center", styles.iconClass)}>
        {icon ?? <VariantIcon className="h-5 w-5" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1 space-y-[var(--space-1)]">
        {title ? (
          <div
            className={cn(
              "text-[length:var(--type-subhead-size)] font-[var(--weight-semibold)] leading-[var(--type-line-height-snug)]",
              styles.titleClass,
            )}
          >
            {title}
          </div>
        ) : null}
        {children ? (
          <div className="text-[length:var(--type-footnote-size)] leading-[var(--type-line-height-normal)] text-[color:var(--color-text-muted)]">
            {children}
          </div>
        ) : null}
      </div>
    </div>
  )
})

export default Alert

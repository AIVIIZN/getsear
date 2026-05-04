"use client"

import * as React from "react"
import { Inbox, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export interface EmptyStateAction {
  label: string
  onClick: () => void
}

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon
  illustration?: React.ReactNode
  title: string
  description?: string
  action?: EmptyStateAction
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(function EmptyState(
  { icon: Icon = Inbox, illustration, title, description, action, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      data-slot="empty-state"
      className={cn(
        "flex w-full flex-col items-center justify-center text-center",
        "px-[var(--space-6)] py-[var(--space-12)]",
        className,
      )}
      {...props}
    >
      <div
        aria-hidden
        className={cn(
          "flex h-16 w-16 items-center justify-center rounded-[var(--radius-lg)]",
          "bg-[color:var(--color-bg-muted)] text-[color:var(--color-text-muted)]",
          "mb-[var(--space-5)]",
        )}
      >
        {illustration ?? <Icon className="h-10 w-10" strokeWidth={1.5} />}
      </div>
      <h3
        className={cn(
          "text-[length:var(--type-title-3-size)] font-[var(--weight-semibold)]",
          "leading-[var(--type-line-height-snug)] text-[color:var(--color-text)]",
        )}
      >
        {title}
      </h3>
      {description ? (
        <p
          className={cn(
            "mt-[var(--space-2)] max-w-md",
            "text-[length:var(--type-subhead-size)] leading-[var(--type-line-height-normal)]",
            "text-[color:var(--color-text-muted)]",
          )}
        >
          {description}
        </p>
      ) : null}
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className={cn(
            "btn-press touch-target mt-[var(--space-6)] inline-flex items-center justify-center",
            "rounded-[var(--radius-sm)] px-[var(--space-5)]",
            "bg-[color:var(--color-primary)] text-[color:var(--color-primary-fg)]",
            "text-[length:var(--type-callout-size)] font-[var(--weight-semibold)]",
            "transition-colors duration-[var(--duration-quick)] ease-[var(--ease-out)]",
            "hover:bg-[color:var(--color-primary-hover)]",
            "active:bg-[color:var(--color-primary-active)]",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-border-focus)]",
            "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none",
          )}
        >
          {action.label}
        </button>
      ) : null}
    </div>
  )
})

export default EmptyState

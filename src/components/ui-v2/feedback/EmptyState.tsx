"use client"

import Image from "next/image"
import * as React from "react"
import { Inbox, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export const EMPTY_STATE_ILLUSTRATIONS = [
  "no-orders",
  "no-menu-items",
  "no-customers",
  "no-reservations",
  "no-inventory",
  "no-reports",
] as const

export type EmptyStateIllustration = (typeof EMPTY_STATE_ILLUSTRATIONS)[number]

const ILLUSTRATION_ALT: Record<EmptyStateIllustration, string> = {
  "no-orders": "No orders illustration",
  "no-menu-items": "No menu items illustration",
  "no-customers": "No customers illustration",
  "no-reservations": "No reservations illustration",
  "no-inventory": "No inventory illustration",
  "no-reports": "No reports illustration",
}

function isIllustrationId(value: unknown): value is EmptyStateIllustration {
  return typeof value === "string" && (EMPTY_STATE_ILLUSTRATIONS as readonly string[]).includes(value)
}

export interface EmptyStateAction {
  label: string
  onClick: () => void
}

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon
  illustration?: EmptyStateIllustration | React.ReactNode
  title: string
  description?: string
  action?: EmptyStateAction
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(function EmptyState(
  { icon: Icon = Inbox, illustration, title, description, action, className, ...props },
  ref,
) {
  const namedIllustration = isIllustrationId(illustration) ? illustration : null

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
      {namedIllustration ? (
        <div
          aria-hidden
          className={cn(
            "flex items-center justify-center text-[color:var(--color-text-muted)]",
            "mb-[var(--space-5)]",
          )}
        >
          <Image
            src={`/illustrations/${namedIllustration}.svg`}
            alt={ILLUSTRATION_ALT[namedIllustration]}
            width={192}
            height={160}
            priority={false}
            unoptimized
            className="h-40 w-48 select-none"
          />
        </div>
      ) : (
        <div
          aria-hidden
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-[var(--radius-lg)]",
            "bg-[color:var(--color-bg-muted)] text-[color:var(--color-text-muted)]",
            "mb-[var(--space-5)]",
          )}
        >
          {illustration && !isIllustrationId(illustration) ? (
            illustration as React.ReactNode
          ) : (
            <Icon className="h-10 w-10" strokeWidth={1.5} />
          )}
        </div>
      )}
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

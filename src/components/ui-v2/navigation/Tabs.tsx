"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/*
 * Sear POS UI v2 — Tabs
 * Spec: docs/design/UI_V2_COMPONENT_SPEC.md → "Tabs" + universal rules
 *       build-pipeline/versions/V6_VISUAL.md → 6.1.5 Navigation
 *
 * Two variants:
 *   - line:      underline animates between active tabs (280ms ease-out)
 *   - segmented: iOS-style pill bg, active tab gets var(--color-bg) + var(--shadow-low)
 *
 * Sizes: md (40pt back-office), lg (44pt POS — Apple HIG min touch).
 *
 * Controlled API: value + onValueChange. Tab list manages roving focus + arrow keys.
 */

export type TabsVariant = "line" | "segmented"
export type TabsSize = "md" | "lg"

export interface TabItem {
  value: string
  label: React.ReactNode
  disabled?: boolean
  /** Optional leading icon. */
  icon?: React.ReactNode
}

export interface TabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  items: TabItem[]
  value: string
  onValueChange: (value: string) => void
  variant?: TabsVariant
  size?: TabsSize
  /** Take full width and distribute tabs equally. */
  fullWidth?: boolean
  /** Aria label for the tablist. */
  ariaLabel?: string
}

const SIZE_CLASSES: Record<TabsSize, string> = {
  md: "h-[40px] px-[var(--space-3)] text-[var(--type-subhead-size)]",
  lg: "h-[44px] px-[var(--space-4)] text-[var(--type-callout-size)] touch-target",
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(function Tabs(
  {
    className,
    items,
    value,
    onValueChange,
    variant = "line",
    size = "md",
    fullWidth = false,
    ariaLabel,
    ...props
  },
  ref,
) {
  // Refs to each tab button for measuring underline + roving focus.
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([])
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const [indicator, setIndicator] = React.useState<{ left: number; width: number } | null>(
    null,
  )

  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.value === value),
  )

  // Measure active tab to position the line underline.
  React.useLayoutEffect(() => {
    if (variant !== "line") return
    const list = listRef.current
    const node = tabRefs.current[activeIndex]
    if (!list || !node) return
    const listRect = list.getBoundingClientRect()
    const nodeRect = node.getBoundingClientRect()
    setIndicator({
      left: nodeRect.left - listRect.left,
      width: nodeRect.width,
    })
  }, [activeIndex, variant, items.length, fullWidth, size])

  // Re-measure on resize (orientation change, dynamic font scale).
  React.useEffect(() => {
    if (variant !== "line") return
    const handler = () => {
      const list = listRef.current
      const node = tabRefs.current[activeIndex]
      if (!list || !node) return
      const listRect = list.getBoundingClientRect()
      const nodeRect = node.getBoundingClientRect()
      setIndicator({
        left: nodeRect.left - listRect.left,
        width: nodeRect.width,
      })
    }
    window.addEventListener("resize", handler)
    return () => window.removeEventListener("resize", handler)
  }, [activeIndex, variant])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const enabled = items
      .map((item, idx) => ({ idx, disabled: item.disabled }))
      .filter((m) => !m.disabled)
    if (enabled.length === 0) return
    const currentPos = enabled.findIndex((m) => m.idx === activeIndex)
    let nextPos = currentPos
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault()
      nextPos = (currentPos + 1) % enabled.length
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault()
      nextPos = (currentPos - 1 + enabled.length) % enabled.length
    } else if (event.key === "Home") {
      event.preventDefault()
      nextPos = 0
    } else if (event.key === "End") {
      event.preventDefault()
      nextPos = enabled.length - 1
    } else {
      return
    }
    const target = enabled[nextPos]
    const targetItem = items[target.idx]
    onValueChange(targetItem.value)
    requestAnimationFrame(() => tabRefs.current[target.idx]?.focus())
  }

  if (variant === "segmented") {
    return (
      <div
        ref={ref}
        data-component="ui-v2-tabs"
        data-variant="segmented"
        className={cn("inline-flex", fullWidth && "w-full", className)}
        {...props}
      >
        <div
          ref={listRef}
          role="tablist"
          aria-label={ariaLabel}
          onKeyDown={handleKeyDown}
          className={cn(
            "inline-flex items-center gap-[2px]",
            "p-[2px]",
            "rounded-[var(--radius-sm)]",
            "bg-[var(--color-bg-muted)]",
            fullWidth && "w-full",
          )}
        >
          {items.map((item, idx) => {
            const isActive = item.value === value
            return (
              <button
                key={item.value}
                ref={(el) => {
                  tabRefs.current[idx] = el
                }}
                role="tab"
                type="button"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                disabled={item.disabled}
                onClick={() => onValueChange(item.value)}
                className={cn(
                  "btn-press inline-flex items-center justify-center gap-[var(--space-2)]",
                  "rounded-[calc(var(--radius-sm)-2px)]",
                  "font-[var(--weight-medium)] leading-[var(--type-line-height-tight)]",
                  "transition-[background-color,color,box-shadow] duration-[var(--duration-quick)] ease-[var(--ease-out)]",
                  "outline-none focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] focus-visible:outline-offset-2",
                  "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none",
                  "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-[16px]",
                  SIZE_CLASSES[size],
                  fullWidth && "flex-1",
                  isActive
                    ? cn(
                        "bg-[var(--color-bg)] text-[var(--color-text)]",
                        "shadow-[var(--shadow-low)] font-[var(--weight-semibold)]",
                      )
                    : cn(
                        "bg-transparent text-[var(--color-text-muted)]",
                        "hover:text-[var(--color-text)]",
                      ),
                )}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Line variant — animated underline.
  return (
    <div
      ref={ref}
      data-component="ui-v2-tabs"
      data-variant="line"
      className={cn("w-full", className)}
      {...props}
    >
      <div
        ref={listRef}
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={handleKeyDown}
        className={cn(
          "relative flex items-center",
          "border-b border-[var(--color-border)]",
          fullWidth ? "w-full" : "w-fit",
        )}
      >
        {items.map((item, idx) => {
          const isActive = item.value === value
          return (
            <button
              key={item.value}
              ref={(el) => {
                tabRefs.current[idx] = el
              }}
              role="tab"
              type="button"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              disabled={item.disabled}
              onClick={() => onValueChange(item.value)}
              className={cn(
                "btn-press inline-flex items-center justify-center gap-[var(--space-2)]",
                "leading-[var(--type-line-height-tight)]",
                "transition-[color] duration-[var(--duration-quick)] ease-[var(--ease-out)]",
                "outline-none focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] focus-visible:outline-offset-2 focus-visible:rounded-[var(--radius-sm)]",
                "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none",
                "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-[16px]",
                SIZE_CLASSES[size],
                fullWidth && "flex-1",
                isActive
                  ? "text-[var(--color-primary)] font-[var(--weight-semibold)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] font-[var(--weight-medium)]",
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          )
        })}
        {/* Animated underline — slides between active tabs in 280ms ease-out per spec. */}
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute bottom-0 h-[2px]",
            "bg-[var(--color-primary)]",
            "rounded-[var(--radius-pill)]",
            "transition-[left,width] duration-[var(--duration-base)] ease-[var(--ease-out)]",
          )}
          style={{
            left: indicator?.left ?? 0,
            width: indicator?.width ?? 0,
            opacity: indicator ? 1 : 0,
          }}
        />
      </div>
    </div>
  )
})

export { Tabs }
export default Tabs

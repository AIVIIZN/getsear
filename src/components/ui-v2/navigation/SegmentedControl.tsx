"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/*
 * Sear POS UI v2 — SegmentedControl
 * Spec: docs/design/UI_V2_COMPONENT_SPEC.md (universal rules) +
 *       build-pipeline/versions/V6_VISUAL.md → 6.1.5 Navigation
 *
 * iOS-style segmented control. 2–5 segments (per Apple HIG).
 * Active segment lifts off the muted track with var(--color-bg) + var(--shadow-low).
 * The active "thumb" slides between segments with a 280ms ease-out transition.
 *
 * Uses radiogroup semantics — the segmented control is a single-select picker.
 * For tabbed page-switching, use Tabs (variant="segmented") instead.
 */

export type SegmentedControlSize = "md" | "lg"

export interface SegmentedControlOption<T extends string = string> {
  value: T
  label: React.ReactNode
  disabled?: boolean
  /** Optional leading icon. */
  icon?: React.ReactNode
}

export interface SegmentedControlProps<T extends string = string>
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  options: SegmentedControlOption<T>[]
  value: T
  onValueChange: (value: T) => void
  size?: SegmentedControlSize
  /** Aria label for the radiogroup. */
  ariaLabel?: string
  /** Take full width of the container. */
  fullWidth?: boolean
  name?: string
}

const SIZE_CLASSES: Record<SegmentedControlSize, string> = {
  md: "h-[40px] text-[var(--type-subhead-size)]",
  lg: "h-[44px] text-[var(--type-callout-size)] touch-target",
}

function SegmentedControlInner<T extends string = string>(
  {
    className,
    options,
    value,
    onValueChange,
    size = "md",
    ariaLabel,
    fullWidth = false,
    name,
    ...props
  }: SegmentedControlProps<T>,
  ref: React.Ref<HTMLDivElement>,
) {
  const segmentRefs = React.useRef<Array<HTMLButtonElement | null>>([])
  const trackRef = React.useRef<HTMLDivElement | null>(null)
  const [thumb, setThumb] = React.useState<{ left: number; width: number } | null>(null)

  const activeIndex = Math.max(
    0,
    options.findIndex((opt) => opt.value === value),
  )

  React.useLayoutEffect(() => {
    const track = trackRef.current
    const node = segmentRefs.current[activeIndex]
    if (!track || !node) return
    const trackRect = track.getBoundingClientRect()
    const nodeRect = node.getBoundingClientRect()
    setThumb({
      left: nodeRect.left - trackRect.left,
      width: nodeRect.width,
    })
  }, [activeIndex, options.length, fullWidth, size])

  React.useEffect(() => {
    const handler = () => {
      const track = trackRef.current
      const node = segmentRefs.current[activeIndex]
      if (!track || !node) return
      const trackRect = track.getBoundingClientRect()
      const nodeRect = node.getBoundingClientRect()
      setThumb({
        left: nodeRect.left - trackRect.left,
        width: nodeRect.width,
      })
    }
    window.addEventListener("resize", handler)
    return () => window.removeEventListener("resize", handler)
  }, [activeIndex])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const enabled = options
      .map((opt, idx) => ({ idx, disabled: opt.disabled }))
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
    onValueChange(options[target.idx].value)
    requestAnimationFrame(() => segmentRefs.current[target.idx]?.focus())
  }

  // Apple HIG: 2-5 segments. Render nothing rather than something incorrect.
  if (options.length < 2 || options.length > 5) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[SegmentedControl] Expected 2-5 options, received ${options.length}. Rendering nothing.`,
      )
    }
    return null
  }

  return (
    <div
      ref={ref}
      data-component="ui-v2-segmented-control"
      className={cn("inline-flex", fullWidth && "w-full", className)}
      {...props}
    >
      <div
        ref={trackRef}
        role="radiogroup"
        aria-label={ariaLabel}
        onKeyDown={handleKeyDown}
        className={cn(
          "relative inline-flex items-stretch",
          "p-[2px]",
          "rounded-[var(--radius-sm)]",
          "bg-[var(--color-bg-muted)]",
          fullWidth && "w-full",
        )}
      >
        {/* Sliding active thumb — iOS pill behind the active segment. */}
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-[2px] bottom-[2px]",
            "bg-[var(--color-bg)]",
            "rounded-[calc(var(--radius-sm)-2px)]",
            "shadow-[var(--shadow-low)]",
            "transition-[left,width] duration-[var(--duration-base)] ease-[var(--ease-out)]",
          )}
          style={{
            left: thumb?.left ?? 2,
            width: thumb?.width ?? 0,
            opacity: thumb ? 1 : 0,
          }}
        />
        {options.map((opt, idx) => {
          const isActive = opt.value === value
          return (
            <button
              key={opt.value}
              ref={(el) => {
                segmentRefs.current[idx] = el
              }}
              type="button"
              role="radio"
              name={name}
              aria-checked={isActive}
              tabIndex={isActive ? 0 : -1}
              disabled={opt.disabled}
              onClick={() => onValueChange(opt.value)}
              className={cn(
                "btn-press relative z-[1] inline-flex items-center justify-center gap-[var(--space-2)]",
                "px-[var(--space-4)]",
                "rounded-[calc(var(--radius-sm)-2px)]",
                "font-[var(--weight-medium)] leading-[var(--type-line-height-tight)]",
                "transition-[color] duration-[var(--duration-quick)] ease-[var(--ease-out)]",
                "outline-none focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] focus-visible:outline-offset-2",
                "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none",
                "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-[16px]",
                SIZE_CLASSES[size],
                fullWidth && "flex-1",
                isActive
                  ? "text-[var(--color-text)] font-[var(--weight-semibold)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
              )}
            >
              {opt.icon}
              <span>{opt.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const SegmentedControl = React.forwardRef(SegmentedControlInner) as <
  T extends string = string,
>(
  props: SegmentedControlProps<T> & { ref?: React.Ref<HTMLDivElement> },
) => React.ReactElement | null

export { SegmentedControl }
export default SegmentedControl

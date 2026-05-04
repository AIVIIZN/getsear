import * as React from "react"
import { cn } from "@/lib/utils"

export type SegmentedSize = "md" | "lg"

export type SegmentedOption<V extends string = string> = {
  value: V
  label: React.ReactNode
  icon?: React.ReactNode
  disabled?: boolean
}

export type SegmentedProps<V extends string = string> = {
  options: SegmentedOption<V>[]
  value?: V
  defaultValue?: V
  onChange?: (value: V) => void
  size?: SegmentedSize
  fullWidth?: boolean
  ariaLabel?: string
  className?: string
  disabled?: boolean
}

const sizeClasses: Record<SegmentedSize, string> = {
  md: "h-[40px] text-[length:var(--type-subhead-size)] p-[3px]",
  lg: "h-[44px] text-[length:var(--type-callout-size)] p-[3px]",
}

function SegmentedInner<V extends string = string>(
  {
    options,
    value,
    defaultValue,
    onChange,
    size = "md",
    fullWidth,
    ariaLabel,
    className,
    disabled,
  }: SegmentedProps<V>,
  ref: React.Ref<HTMLDivElement>,
) {
  const isControlled = value !== undefined
  const [internal, setInternal] = React.useState<V | undefined>(defaultValue)
  const current = isControlled ? value : internal

  const select = (next: V) => {
    if (!isControlled) setInternal(next)
    onChange?.(next)
  }

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center rounded-[var(--radius-sm)] bg-[var(--color-bg-muted)] gap-[2px]",
        fullWidth && "w-full",
        disabled && "opacity-40 pointer-events-none",
        sizeClasses[size],
        className,
      )}
    >
      {options.map((opt) => {
        const active = current === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled || opt.disabled}
            onClick={() => select(opt.value)}
            className={cn(
              "inline-flex items-center justify-center gap-[var(--space-1)] px-[var(--space-3)] h-full rounded-[calc(var(--radius-sm)-2px)]",
              "font-[var(--weight-medium)] text-[var(--color-text)]",
              "transition-[background-color,box-shadow,color] duration-[var(--duration-quick)] ease-[var(--ease-out)]",
              "focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]",
              "disabled:cursor-not-allowed",
              active
                ? "bg-[var(--color-bg)] shadow-[var(--shadow-low)] text-[var(--color-text)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
              fullWidth && "flex-1",
            )}
          >
            {opt.icon ? (
              <span className="inline-flex items-center">{opt.icon}</span>
            ) : null}
            <span>{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}

const Segmented = React.forwardRef(SegmentedInner) as <V extends string = string>(
  props: SegmentedProps<V> & { ref?: React.Ref<HTMLDivElement> },
) => ReturnType<typeof SegmentedInner>

export default Segmented
export { Segmented }

import * as React from "react"
import { cn } from "@/lib/utils"
import { Field } from "./Field"

export type SliderSize = "md" | "lg"

export type SliderProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "size" | "type" | "onChange"
> & {
  size?: SliderSize
  value?: number
  defaultValue?: number
  onChange?: (value: number) => void
  min?: number
  max?: number
  step?: number
  label?: React.ReactNode
  helper?: React.ReactNode
  error?: React.ReactNode
  showValue?: boolean
  formatValue?: (value: number) => React.ReactNode
  fieldClassName?: string
  invalid?: boolean
}

const trackHeights: Record<SliderSize, string> = {
  md: "h-[6px]",
  lg: "h-[8px]",
}

const thumbSizes: Record<SliderSize, number> = {
  md: 20,
  lg: 24,
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(function Slider(
  {
    size = "md",
    value,
    defaultValue,
    onChange,
    min = 0,
    max = 100,
    step = 1,
    label,
    helper,
    error,
    invalid,
    showValue,
    formatValue,
    disabled,
    className,
    fieldClassName,
    id,
    "aria-describedby": ariaDescribedBy,
    ...rest
  },
  ref,
) {
  const reactId = React.useId()
  const inputId = id ?? reactId
  const isControlled = value !== undefined
  const [internal, setInternal] = React.useState<number>(defaultValue ?? min)
  const current = isControlled ? Number(value) : internal
  const isInvalid = Boolean(invalid || error)

  const helperId = helper && !error ? `${inputId}-helper` : undefined
  const errorId = error ? `${inputId}-error` : undefined
  const describedBy =
    [ariaDescribedBy, helperId, errorId].filter(Boolean).join(" ") || undefined

  const range = Math.max(1, max - min)
  const pct = Math.min(100, Math.max(0, ((current - min) / range) * 100))
  const thumbPx = thumbSizes[size]

  const slider = (
    <div className="flex flex-col gap-[var(--space-2)]">
      {showValue ? (
        <div className="flex items-center justify-end">
          <span className="text-[length:var(--type-footnote-size)] font-[var(--weight-medium)] text-[var(--color-text-muted)] tabular-nums">
            {formatValue ? formatValue(current) : current}
          </span>
        </div>
      ) : null}
      <div className="relative flex items-center w-full">
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-x-0 rounded-full bg-[var(--color-bg-muted)]",
            trackHeights[size],
          )}
        />
        <div
          aria-hidden="true"
          style={{ width: `${pct}%` }}
          className={cn(
            "absolute left-0 rounded-full bg-[var(--color-primary)]",
            trackHeights[size],
            isInvalid && "bg-[var(--color-danger)]",
          )}
        />
        <input
          ref={ref}
          id={inputId}
          type="range"
          min={min}
          max={max}
          step={step}
          value={current}
          disabled={disabled}
          aria-invalid={isInvalid || undefined}
          aria-describedby={describedBy}
          onChange={(e) => {
            const next = Number(e.target.value)
            if (!isControlled) setInternal(next)
            onChange?.(next)
          }}
          className={cn(
            "relative w-full appearance-none bg-transparent cursor-pointer",
            "focus:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-40",
            "[&::-webkit-slider-runnable-track]:bg-transparent",
            "[&::-moz-range-track]:bg-transparent",
            "[&::-webkit-slider-thumb]:appearance-none",
            "[&::-webkit-slider-thumb]:rounded-full",
            "[&::-webkit-slider-thumb]:bg-white",
            "[&::-webkit-slider-thumb]:border",
            "[&::-webkit-slider-thumb]:border-[var(--color-border)]",
            "[&::-webkit-slider-thumb]:shadow-[var(--shadow-low)]",
            "[&::-moz-range-thumb]:rounded-full",
            "[&::-moz-range-thumb]:bg-white",
            "[&::-moz-range-thumb]:border",
            "[&::-moz-range-thumb]:border-[var(--color-border)]",
            "[&::-moz-range-thumb]:shadow-[var(--shadow-low)]",
            "focus-visible:[&::-webkit-slider-thumb]:outline-none",
            "focus-visible:[&::-webkit-slider-thumb]:ring-2",
            "focus-visible:[&::-webkit-slider-thumb]:ring-[var(--color-border-focus)]",
            "focus-visible:[&::-webkit-slider-thumb]:ring-offset-2",
            className,
          )}
          style={{
            // Custom thumb sizing via inline style (Tailwind arbitrary
            // selectors can't fully size the WebKit thumb).
            ...({
              ["--slider-thumb-size" as string]: `${thumbPx}px`,
            } as React.CSSProperties),
            height: `${thumbPx}px`,
          }}
          {...rest}
        />
        <style>{`
          #${cssEscape(inputId)}::-webkit-slider-thumb { width: ${thumbPx}px; height: ${thumbPx}px; }
          #${cssEscape(inputId)}::-moz-range-thumb { width: ${thumbPx}px; height: ${thumbPx}px; border: 1px solid var(--color-border); }
        `}</style>
      </div>
    </div>
  )

  if (!label && !helper && !error) return slider

  return (
    <Field
      id={inputId}
      label={label}
      helper={helper}
      error={error}
      disabled={disabled}
      className={fieldClassName}
    >
      {slider}
    </Field>
  )
})

function cssEscape(value: string): string {
  if (typeof window !== "undefined" && typeof window.CSS?.escape === "function") {
    return window.CSS.escape(value)
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`)
}

export default Slider
export { Slider }

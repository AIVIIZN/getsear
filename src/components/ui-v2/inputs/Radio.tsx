import * as React from "react"
import { cn } from "@/lib/utils"

export type RadioSize = "md" | "lg"

export type RadioProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "size" | "type"
> & {
  size?: RadioSize
  label?: React.ReactNode
  invalid?: boolean
}

const dotSizeClasses: Record<RadioSize, string> = {
  md: "h-[20px] w-[20px]",
  lg: "h-[24px] w-[24px]",
}

const innerSizeClasses: Record<RadioSize, string> = {
  md: "h-[8px] w-[8px]",
  lg: "h-[10px] w-[10px]",
}

const Radio = React.forwardRef<HTMLInputElement, RadioProps>(function Radio(
  {
    size = "md",
    label,
    invalid,
    disabled,
    className,
    id,
    ...rest
  },
  ref,
) {
  const reactId = React.useId()
  const inputId = id ?? reactId

  return (
    <label
      htmlFor={inputId}
      className={cn(
        "group inline-flex items-center gap-[var(--space-2)] cursor-pointer select-none",
        disabled && "opacity-40 cursor-not-allowed pointer-events-none",
      )}
    >
      <span className="relative inline-flex items-center justify-center min-h-[var(--touch-min)] min-w-[var(--touch-min)]">
        <input
          ref={ref}
          id={inputId}
          type="radio"
          disabled={disabled}
          data-invalid={invalid || undefined}
          className="peer sr-only"
          {...rest}
        />
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex items-center justify-center rounded-full border bg-[var(--color-surface)]",
            "border-[var(--color-border-strong)]",
            "transition-[background-color,border-color,box-shadow] duration-[var(--duration-quick)] ease-[var(--ease-out)]",
            "peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-border-focus)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--color-bg)]",
            "peer-checked:border-[var(--color-primary)]",
            invalid && "border-[var(--color-danger)]",
            dotSizeClasses[size],
            className,
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "rounded-full bg-[var(--color-primary)] scale-0 peer-checked:scale-100 transition-transform duration-[var(--duration-quick)] ease-[var(--ease-out)] hidden peer-checked:block",
              innerSizeClasses[size],
            )}
          />
        </span>
      </span>
      {label ? (
        <span className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[var(--color-text)] leading-[var(--type-line-height-snug)]">
          {label}
        </span>
      ) : null}
    </label>
  )
})

export type RadioGroupOption = {
  value: string
  label: React.ReactNode
  disabled?: boolean
}

export type RadioGroupProps = {
  name: string
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  options: RadioGroupOption[]
  size?: RadioSize
  orientation?: "vertical" | "horizontal"
  label?: React.ReactNode
  helper?: React.ReactNode
  error?: React.ReactNode
  required?: boolean
  disabled?: boolean
  className?: string
  fieldClassName?: string
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  function RadioGroup(
    {
      name,
      value,
      defaultValue,
      onChange,
      options,
      size = "md",
      orientation = "vertical",
      label,
      helper,
      error,
      required,
      disabled,
      className,
      fieldClassName,
    },
    ref,
  ) {
    const reactId = React.useId()
    const groupId = `${reactId}-group`
    const isControlled = value !== undefined
    const [internal, setInternal] = React.useState(defaultValue ?? "")
    const current = isControlled ? value : internal

    return (
      <div
        ref={ref}
        role="radiogroup"
        aria-labelledby={label ? `${groupId}-label` : undefined}
        aria-required={required || undefined}
        aria-invalid={Boolean(error) || undefined}
        className={cn(
          "flex flex-col gap-[var(--space-2)]",
          disabled && "opacity-40 pointer-events-none",
          fieldClassName,
        )}
      >
        {label ? (
          <span
            id={`${groupId}-label`}
            className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[var(--color-text)] leading-[var(--type-line-height-snug)]"
          >
            {label}
            {required ? (
              <span
                aria-hidden="true"
                className="ml-[var(--space-1)] text-[var(--color-danger)]"
              >
                *
              </span>
            ) : null}
          </span>
        ) : null}
        <div
          className={cn(
            orientation === "horizontal"
              ? "flex flex-wrap items-center gap-[var(--space-4)]"
              : "flex flex-col gap-[var(--space-1)]",
            className,
          )}
        >
          {options.map((opt) => (
            <Radio
              key={opt.value}
              name={name}
              value={opt.value}
              size={size}
              label={opt.label}
              checked={current === opt.value}
              disabled={disabled || opt.disabled}
              invalid={Boolean(error)}
              onChange={(e) => {
                if (!isControlled) setInternal(e.target.value)
                onChange?.(e.target.value)
              }}
            />
          ))}
        </div>
        {error ? (
          <p
            role="alert"
            className="text-[length:var(--type-footnote-size)] text-[var(--color-danger)] leading-[var(--type-line-height-snug)]"
          >
            {error}
          </p>
        ) : helper ? (
          <p className="text-[length:var(--type-footnote-size)] text-[var(--color-text-muted)] leading-[var(--type-line-height-snug)]">
            {helper}
          </p>
        ) : null}
      </div>
    )
  },
)

export default Radio
export { Radio, RadioGroup }

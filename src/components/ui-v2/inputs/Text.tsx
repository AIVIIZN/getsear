import * as React from "react"
import { cn } from "@/lib/utils"
import { Field } from "./Field"

export type TextSize = "md" | "lg"

export type TextProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & {
  size?: TextSize
  invalid?: boolean
  label?: React.ReactNode
  helper?: React.ReactNode
  error?: React.ReactNode
  fieldClassName?: string
  leadingIcon?: React.ReactNode
  trailingIcon?: React.ReactNode
}

const sizeClasses: Record<TextSize, string> = {
  md: "h-[40px] px-[var(--space-3)] text-[length:var(--type-subhead-size)]",
  lg: "h-[44px] px-[var(--space-4)] text-[length:var(--type-body-size)]",
}

const Text = React.forwardRef<HTMLInputElement, TextProps>(function Text(
  {
    size = "md",
    invalid,
    label,
    helper,
    error,
    required,
    disabled,
    readOnly,
    className,
    fieldClassName,
    id,
    leadingIcon,
    trailingIcon,
    type = "text",
    "aria-describedby": ariaDescribedBy,
    ...rest
  },
  ref,
) {
  const reactId = React.useId()
  const inputId = id ?? reactId
  const isInvalid = Boolean(invalid || error)
  const helperId = helper && !error ? `${inputId}-helper` : undefined
  const errorId = error ? `${inputId}-error` : undefined
  const describedBy =
    [ariaDescribedBy, helperId, errorId].filter(Boolean).join(" ") || undefined

  const input = (
    <div className="relative flex items-center">
      {leadingIcon ? (
        <span className="pointer-events-none absolute left-[var(--space-3)] flex items-center text-[var(--color-text-muted)]">
          {leadingIcon}
        </span>
      ) : null}
      <input
        ref={ref}
        id={inputId}
        type={type}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={isInvalid || undefined}
        aria-describedby={describedBy}
        className={cn(
          "w-full rounded-[var(--radius-sm)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)]",
          "border border-[var(--color-border)]",
          "transition-[border-color,box-shadow] duration-[var(--duration-quick)] ease-[var(--ease-out)]",
          "focus:outline-none focus-visible:outline-none",
          "focus-visible:border-[var(--color-border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          "read-only:bg-[var(--color-bg-subtle)] read-only:text-[var(--color-text-muted)]",
          sizeClasses[size],
          leadingIcon && "pl-[calc(var(--space-3)+1.5rem)]",
          trailingIcon && "pr-[calc(var(--space-3)+1.5rem)]",
          isInvalid &&
            "border-[var(--color-danger)] focus-visible:border-[var(--color-danger)] focus-visible:ring-[var(--color-danger)]",
          className,
        )}
        {...rest}
      />
      {trailingIcon ? (
        <span className="pointer-events-none absolute right-[var(--space-3)] flex items-center text-[var(--color-text-muted)]">
          {trailingIcon}
        </span>
      ) : null}
    </div>
  )

  if (!label && !helper && !error) {
    return input
  }

  return (
    <Field
      id={inputId}
      label={label}
      helper={helper}
      error={error}
      required={required}
      disabled={disabled}
      className={fieldClassName}
    >
      {input}
    </Field>
  )
})

export default Text
export { Text }

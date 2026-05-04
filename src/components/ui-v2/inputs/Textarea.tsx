import * as React from "react"
import { cn } from "@/lib/utils"
import { Field } from "./Field"

export type TextareaSize = "md" | "lg"

export type TextareaProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "size"
> & {
  size?: TextareaSize
  invalid?: boolean
  label?: React.ReactNode
  helper?: React.ReactNode
  error?: React.ReactNode
  fieldClassName?: string
}

const sizeClasses: Record<TextareaSize, string> = {
  md: "min-h-[80px] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--type-subhead-size)]",
  lg: "min-h-[96px] px-[var(--space-4)] py-[var(--space-3)] text-[length:var(--type-body-size)]",
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
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

    const textarea = (
      <textarea
        ref={ref}
        id={inputId}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={isInvalid || undefined}
        aria-describedby={describedBy}
        className={cn(
          "w-full rounded-[var(--radius-sm)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)]",
          "border border-[var(--color-border)] resize-vertical",
          "transition-[border-color,box-shadow] duration-[var(--duration-quick)] ease-[var(--ease-out)]",
          "focus:outline-none focus-visible:outline-none",
          "focus-visible:border-[var(--color-border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          "read-only:bg-[var(--color-bg-subtle)] read-only:text-[var(--color-text-muted)]",
          sizeClasses[size],
          isInvalid &&
            "border-[var(--color-danger)] focus-visible:border-[var(--color-danger)] focus-visible:ring-[var(--color-danger)]",
          className,
        )}
        {...rest}
      />
    )

    if (!label && !helper && !error) {
      return textarea
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
        {textarea}
      </Field>
    )
  },
)

export default Textarea
export { Textarea }

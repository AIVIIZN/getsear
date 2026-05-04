import * as React from "react"
import { cn } from "@/lib/utils"

export type FieldProps = {
  id?: string
  label?: React.ReactNode
  helper?: React.ReactNode
  error?: React.ReactNode
  required?: boolean
  disabled?: boolean
  className?: string
  labelClassName?: string
  helperClassName?: string
  errorClassName?: string
  children: React.ReactNode
}

const Field = React.forwardRef<HTMLDivElement, FieldProps>(function Field(
  {
    id,
    label,
    helper,
    error,
    required,
    disabled,
    className,
    labelClassName,
    helperClassName,
    errorClassName,
    children,
  },
  ref,
) {
  const helperId = id ? `${id}-helper` : undefined
  const errorId = id ? `${id}-error` : undefined

  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col gap-[var(--space-1)]",
        disabled && "opacity-40 pointer-events-none",
        className,
      )}
    >
      {label ? (
        <label
          htmlFor={id}
          className={cn(
            "text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[var(--color-text)] leading-[var(--type-line-height-snug)]",
            labelClassName,
          )}
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
        </label>
      ) : null}
      {children}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className={cn(
            "text-[length:var(--type-footnote-size)] text-[var(--color-danger)] leading-[var(--type-line-height-snug)]",
            errorClassName,
          )}
        >
          {error}
        </p>
      ) : helper ? (
        <p
          id={helperId}
          className={cn(
            "text-[length:var(--type-footnote-size)] text-[var(--color-text-muted)] leading-[var(--type-line-height-snug)]",
            helperClassName,
          )}
        >
          {helper}
        </p>
      ) : null}
    </div>
  )
})

export default Field
export { Field }

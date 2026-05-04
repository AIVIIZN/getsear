import * as React from "react"
import { Check, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

export type CheckboxSize = "md" | "lg"

export type CheckboxProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "size" | "type"
> & {
  size?: CheckboxSize
  label?: React.ReactNode
  helper?: React.ReactNode
  error?: React.ReactNode
  invalid?: boolean
  indeterminate?: boolean
  fieldClassName?: string
}

const boxSizeClasses: Record<CheckboxSize, string> = {
  md: "h-[20px] w-[20px]",
  lg: "h-[24px] w-[24px]",
}

const iconSizeClasses: Record<CheckboxSize, string> = {
  md: "h-[14px] w-[14px]",
  lg: "h-[16px] w-[16px]",
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox(
    {
      size = "md",
      label,
      helper,
      error,
      invalid,
      indeterminate,
      disabled,
      required,
      className,
      fieldClassName,
      id,
      checked,
      defaultChecked,
      "aria-describedby": ariaDescribedBy,
      ...rest
    },
    ref,
  ) {
    const reactId = React.useId()
    const inputId = id ?? reactId
    const isInvalid = Boolean(invalid || error)
    const innerRef = React.useRef<HTMLInputElement | null>(null)

    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        innerRef.current = node
        if (typeof ref === "function") ref(node)
        else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node
      },
      [ref],
    )

    React.useEffect(() => {
      if (innerRef.current) {
        innerRef.current.indeterminate = Boolean(indeterminate)
      }
    }, [indeterminate])

    const helperId = helper && !error ? `${inputId}-helper` : undefined
    const errorId = error ? `${inputId}-error` : undefined
    const describedBy =
      [ariaDescribedBy, helperId, errorId].filter(Boolean).join(" ") || undefined

    return (
      <div
        className={cn(
          "flex flex-col gap-[var(--space-1)]",
          disabled && "opacity-40 pointer-events-none",
          fieldClassName,
        )}
      >
        <label
          htmlFor={inputId}
          className={cn(
            "group inline-flex items-start gap-[var(--space-2)] cursor-pointer select-none",
            disabled && "cursor-not-allowed",
          )}
        >
          <span className="relative inline-flex items-center justify-center min-h-[var(--touch-min)] min-w-[var(--touch-min)]">
            <input
              ref={setRefs}
              id={inputId}
              type="checkbox"
              checked={checked}
              defaultChecked={defaultChecked}
              disabled={disabled}
              required={required}
              aria-invalid={isInvalid || undefined}
              aria-describedby={describedBy}
              className="peer sr-only"
              {...rest}
            />
            <span
              aria-hidden="true"
              className={cn(
                "inline-flex items-center justify-center rounded-[var(--radius-xs)] border bg-[var(--color-surface)]",
                "border-[var(--color-border-strong)]",
                "transition-[background-color,border-color,box-shadow] duration-[var(--duration-quick)] ease-[var(--ease-out)]",
                "peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-border-focus)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--color-bg)]",
                "peer-checked:bg-[var(--color-primary)] peer-checked:border-[var(--color-primary)]",
                "peer-indeterminate:bg-[var(--color-primary)] peer-indeterminate:border-[var(--color-primary)]",
                isInvalid && "border-[var(--color-danger)]",
                boxSizeClasses[size],
                className,
              )}
            >
              {indeterminate ? (
                <Minus
                  className={cn(
                    "text-[var(--color-primary-fg)]",
                    iconSizeClasses[size],
                  )}
                  strokeWidth={3}
                />
              ) : (
                <Check
                  className={cn(
                    "text-[var(--color-primary-fg)] opacity-0 peer-checked:opacity-100 hidden peer-checked:block",
                    iconSizeClasses[size],
                  )}
                  strokeWidth={3}
                />
              )}
            </span>
          </span>
          {label ? (
            <span className="flex flex-col gap-[var(--space-0_5)] pt-[6px]">
              <span className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[var(--color-text)] leading-[var(--type-line-height-snug)]">
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
            </span>
          ) : null}
        </label>
        {error ? (
          <p
            id={errorId}
            role="alert"
            className="text-[length:var(--type-footnote-size)] text-[var(--color-danger)] leading-[var(--type-line-height-snug)] pl-[calc(var(--touch-min)+var(--space-2))]"
          >
            {error}
          </p>
        ) : helper ? (
          <p
            id={helperId}
            className="text-[length:var(--type-footnote-size)] text-[var(--color-text-muted)] leading-[var(--type-line-height-snug)] pl-[calc(var(--touch-min)+var(--space-2))]"
          >
            {helper}
          </p>
        ) : null}
      </div>
    )
  },
)

export default Checkbox
export { Checkbox }

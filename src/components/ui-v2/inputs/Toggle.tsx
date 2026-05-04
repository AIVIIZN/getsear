import * as React from "react"
import { cn } from "@/lib/utils"

export type ToggleSize = "md" | "lg"

export type ToggleProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange"
> & {
  size?: ToggleSize
  checked?: boolean
  defaultChecked?: boolean
  onChange?: (checked: boolean) => void
  label?: React.ReactNode
  helper?: React.ReactNode
  fieldClassName?: string
}

const trackSizeClasses: Record<ToggleSize, string> = {
  md: "h-[28px] w-[48px]",
  lg: "h-[32px] w-[52px]",
}

const thumbSizeClasses: Record<ToggleSize, string> = {
  md: "h-[24px] w-[24px]",
  lg: "h-[28px] w-[28px]",
}

const thumbTranslateClasses: Record<ToggleSize, string> = {
  md: "translate-x-[20px]",
  lg: "translate-x-[20px]",
}

const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(function Toggle(
  {
    size = "md",
    checked,
    defaultChecked,
    onChange,
    label,
    helper,
    disabled,
    className,
    fieldClassName,
    id,
    ...rest
  },
  ref,
) {
  const reactId = React.useId()
  const buttonId = id ?? reactId
  const isControlled = checked !== undefined
  const [internal, setInternal] = React.useState(Boolean(defaultChecked))
  const current = isControlled ? Boolean(checked) : internal

  const toggle = () => {
    if (disabled) return
    const next = !current
    if (!isControlled) setInternal(next)
    onChange?.(next)
  }

  const button = (
    <button
      ref={ref}
      id={buttonId}
      type="button"
      role="switch"
      aria-checked={current}
      aria-labelledby={label ? `${buttonId}-label` : undefined}
      aria-describedby={helper ? `${buttonId}-helper` : undefined}
      disabled={disabled}
      onClick={toggle}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full border-2 border-transparent",
        "transition-[background-color] duration-[var(--duration-quick)] ease-[var(--ease-out)]",
        "focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        current
          ? "bg-[var(--color-primary)]"
          : "bg-[var(--color-border-strong)]",
        trackSizeClasses[size],
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none inline-block rounded-full bg-white shadow-[var(--shadow-low)]",
          "transform transition-transform duration-[var(--duration-quick)] ease-[var(--ease-out)]",
          thumbSizeClasses[size],
          current ? thumbTranslateClasses[size] : "translate-x-0",
        )}
      />
    </button>
  )

  if (!label && !helper) return button

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-[var(--space-4)]",
        disabled && "opacity-40",
        fieldClassName,
      )}
    >
      <div className="flex flex-col gap-[var(--space-0_5)]">
        {label ? (
          <label
            id={`${buttonId}-label`}
            htmlFor={buttonId}
            className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[var(--color-text)] leading-[var(--type-line-height-snug)] cursor-pointer"
          >
            {label}
          </label>
        ) : null}
        {helper ? (
          <p
            id={`${buttonId}-helper`}
            className="text-[length:var(--type-footnote-size)] text-[var(--color-text-muted)] leading-[var(--type-line-height-snug)]"
          >
            {helper}
          </p>
        ) : null}
      </div>
      {button}
    </div>
  )
})

export default Toggle
export { Toggle }

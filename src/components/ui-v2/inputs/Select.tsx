"use client"

import * as React from "react"
import { Check, ChevronDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Field } from "./Field"

export type SelectSize = "md" | "lg"

export type SelectOption<V extends string = string> = {
  value: V
  label: React.ReactNode
  searchText?: string
  disabled?: boolean
}

export type SelectProps<V extends string = string> = {
  options: SelectOption<V>[]
  value?: V
  defaultValue?: V
  onChange?: (value: V) => void
  size?: SelectSize
  placeholder?: string
  searchable?: boolean
  searchPlaceholder?: string
  invalid?: boolean
  disabled?: boolean
  required?: boolean
  readOnly?: boolean
  label?: React.ReactNode
  helper?: React.ReactNode
  error?: React.ReactNode
  fieldClassName?: string
  className?: string
  id?: string
  name?: string
  ariaLabel?: string
}

const triggerSize: Record<SelectSize, string> = {
  md: "h-[40px] px-[var(--space-3)] text-[length:var(--type-subhead-size)]",
  lg: "h-[44px] px-[var(--space-4)] text-[length:var(--type-body-size)]",
}

function SelectInner<V extends string = string>(
  {
    options,
    value,
    defaultValue,
    onChange,
    size = "md",
    placeholder = "Select…",
    searchable: searchableProp,
    searchPlaceholder = "Search…",
    invalid,
    disabled,
    required,
    readOnly,
    label,
    helper,
    error,
    fieldClassName,
    className,
    id,
    name,
    ariaLabel,
  }: SelectProps<V>,
  ref: React.Ref<HTMLButtonElement>,
) {
  const reactId = React.useId()
  const triggerId = id ?? reactId
  const listboxId = `${triggerId}-listbox`
  const isControlled = value !== undefined
  const [internal, setInternal] = React.useState<V | undefined>(defaultValue)
  const current = isControlled ? value : internal
  const isInvalid = Boolean(invalid || error)
  const searchable = searchableProp ?? options.length > 8

  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [activeIndex, setActiveIndex] = React.useState<number>(-1)

  const triggerRef = React.useRef<HTMLButtonElement | null>(null)
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const searchRef = React.useRef<HTMLInputElement | null>(null)
  const listRef = React.useRef<HTMLUListElement | null>(null)

  const setRefs = React.useCallback(
    (node: HTMLButtonElement | null) => {
      triggerRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref)
        (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node
    },
    [ref],
  )

  const selectedOption = React.useMemo(
    () => options.find((o) => o.value === current),
    [options, current],
  )

  const filtered = React.useMemo(() => {
    if (!searchable || !query.trim()) return options
    const q = query.trim().toLowerCase()
    return options.filter((o) => {
      const text =
        o.searchText ??
        (typeof o.label === "string" ? o.label : String(o.value))
      return text.toLowerCase().includes(q)
    })
  }, [options, query, searchable])

  React.useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [open])

  React.useEffect(() => {
    if (open) {
      setQuery("")
      const idx = filtered.findIndex((o) => o.value === current)
      setActiveIndex(idx >= 0 ? idx : 0)
      // Focus the search if present, else the listbox.
      requestAnimationFrame(() => {
        if (searchable) searchRef.current?.focus()
        else listRef.current?.focus()
      })
    }
    // Intentionally only react to open changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const commit = (next: V) => {
    if (!isControlled) setInternal(next)
    onChange?.(next)
    setOpen(false)
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const onTriggerKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || readOnly) return
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      setOpen(true)
    }
  }

  const onListKey = (e: React.KeyboardEvent) => {
    if (filtered.length === 0) {
      if (e.key === "Escape") setOpen(false)
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % filtered.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? filtered.length - 1 : i - 1))
    } else if (e.key === "Home") {
      e.preventDefault()
      setActiveIndex(0)
    } else if (e.key === "End") {
      e.preventDefault()
      setActiveIndex(filtered.length - 1)
    } else if (e.key === "Enter") {
      e.preventDefault()
      const opt = filtered[activeIndex]
      if (opt && !opt.disabled) commit(opt.value)
    } else if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
      requestAnimationFrame(() => triggerRef.current?.focus())
    } else if (e.key === "Tab") {
      setOpen(false)
    }
  }

  const trigger = (
    <div ref={containerRef} className="relative">
      <button
        ref={setRefs}
        id={triggerId}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-invalid={isInvalid || undefined}
        aria-required={required || undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => {
          if (disabled || readOnly) return
          setOpen((v) => !v)
        }}
        onKeyDown={onTriggerKey}
        className={cn(
          "w-full inline-flex items-center justify-between gap-[var(--space-2)]",
          "rounded-[var(--radius-sm)] bg-[var(--color-surface)] text-left text-[var(--color-text)]",
          "border border-[var(--color-border)]",
          "transition-[border-color,box-shadow] duration-[var(--duration-quick)] ease-[var(--ease-out)]",
          "focus:outline-none focus-visible:outline-none",
          "focus-visible:border-[var(--color-border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          readOnly && "bg-[var(--color-bg-subtle)] cursor-default",
          isInvalid &&
            "border-[var(--color-danger)] focus-visible:border-[var(--color-danger)] focus-visible:ring-[var(--color-danger)]",
          triggerSize[size],
          className,
        )}
      >
        <span
          className={cn(
            "truncate",
            !selectedOption && "text-[var(--color-text-subtle)]",
          )}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-transform duration-[var(--duration-quick)] ease-[var(--ease-out)]",
            open && "rotate-180",
          )}
        />
      </button>
      {name ? (
        <input type="hidden" name={name} value={current ?? ""} />
      ) : null}
      {open ? (
        <div
          className={cn(
            "absolute z-[var(--z-popover)] mt-[var(--space-1)] w-full",
            "rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]",
            "shadow-[var(--shadow-mid)] overflow-hidden",
          )}
        >
          {searchable ? (
            <div className="flex items-center gap-[var(--space-2)] border-b border-[var(--color-border)] px-[var(--space-3)] py-[var(--space-2)]">
              <Search
                aria-hidden="true"
                className="h-4 w-4 text-[var(--color-text-muted)]"
              />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setActiveIndex(0)
                }}
                onKeyDown={onListKey}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-[length:var(--type-subhead-size)] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:outline-none"
              />
            </div>
          ) : null}
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            tabIndex={-1}
            onKeyDown={onListKey}
            className="max-h-[280px] overflow-auto py-[var(--space-1)] focus:outline-none"
          >
            {filtered.length === 0 ? (
              <li className="px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--type-footnote-size)] text-[var(--color-text-muted)]">
                No results
              </li>
            ) : (
              filtered.map((opt, idx) => {
                const selected = opt.value === current
                const active = idx === activeIndex
                return (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={selected}
                    aria-disabled={opt.disabled || undefined}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => {
                      if (!opt.disabled) commit(opt.value)
                    }}
                    className={cn(
                      "flex items-center justify-between gap-[var(--space-2)] px-[var(--space-3)] py-[var(--space-2)]",
                      "text-[length:var(--type-subhead-size)] text-[var(--color-text)] cursor-pointer",
                      "transition-[background-color] duration-[var(--duration-instant)] ease-[var(--ease-out)]",
                      active && "bg-[var(--color-surface-hover)]",
                      opt.disabled && "opacity-40 cursor-not-allowed",
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {selected ? (
                      <Check
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 text-[var(--color-primary)]"
                      />
                    ) : null}
                  </li>
                )
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )

  if (!label && !helper && !error) return trigger

  return (
    <Field
      id={triggerId}
      label={label}
      helper={helper}
      error={error}
      required={required}
      disabled={disabled}
      className={fieldClassName}
    >
      {trigger}
    </Field>
  )
}

const Select = React.forwardRef(SelectInner) as <V extends string = string>(
  props: SelectProps<V> & { ref?: React.Ref<HTMLButtonElement> },
) => ReturnType<typeof SelectInner>

export default Select
export { Select }

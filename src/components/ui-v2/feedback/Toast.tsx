"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from "lucide-react"

import { cn } from "@/lib/utils"

export type ToastVariant = "success" | "info" | "warning" | "danger"

export interface ToastOptions {
  id?: string
  title: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

interface ToastRecord extends Required<Pick<ToastOptions, "id" | "title" | "variant" | "duration">> {
  description?: string
}

interface ToastContextValue {
  toast: (opts: ToastOptions) => string
  dismiss: (id: string) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

const MAX_VISIBLE = 3
const DEFAULT_DURATION: Record<ToastVariant, number> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  danger: 6000,
}

const variantStyles: Record<
  ToastVariant,
  { wrapper: string; icon: React.ComponentType<{ className?: string }>; iconClass: string }
> = {
  success: {
    wrapper:
      "border-l-[3px] border-l-[color:var(--color-success-strong)] bg-[color:var(--color-surface)]",
    icon: CheckCircle2,
    iconClass: "text-[color:var(--color-success-strong)]",
  },
  info: {
    wrapper:
      "border-l-[3px] border-l-[color:var(--color-primary)] bg-[color:var(--color-surface)]",
    icon: Info,
    iconClass: "text-[color:var(--color-primary)]",
  },
  warning: {
    wrapper:
      "border-l-[3px] border-l-[color:var(--color-warning-strong)] bg-[color:var(--color-surface)]",
    icon: AlertTriangle,
    iconClass: "text-[color:var(--color-warning-strong)]",
  },
  danger: {
    wrapper:
      "border-l-[3px] border-l-[color:var(--color-danger-strong)] bg-[color:var(--color-surface)]",
    icon: XCircle,
    iconClass: "text-[color:var(--color-danger-strong)]",
  },
}

let counter = 0
function nextId() {
  counter += 1
  return `toast-${Date.now().toString(36)}-${counter}`
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = React.useState<ToastRecord[]>([])
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const dismiss = React.useCallback((id: string) => {
    setQueue((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = React.useCallback((opts: ToastOptions) => {
    const variant = opts.variant ?? "info"
    const id = opts.id ?? nextId()
    const record: ToastRecord = {
      id,
      title: opts.title,
      description: opts.description,
      variant,
      duration: opts.duration ?? DEFAULT_DURATION[variant],
    }
    setQueue((prev) => [record, ...prev])
    return id
  }, [])

  const value = React.useMemo<ToastContextValue>(() => ({ toast, dismiss }), [toast, dismiss])

  const visible = queue.slice(0, MAX_VISIBLE)

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted
        ? createPortal(
            <div
              data-slot="toast-viewport"
              aria-live="polite"
              className={cn(
                "pointer-events-none fixed z-[var(--z-toast)] flex flex-col gap-[var(--space-3)]",
                // Mobile: top-center
                "left-1/2 top-[calc(env(safe-area-inset-top)+var(--space-3))] w-[min(calc(100vw-var(--space-6)),360px)] -translate-x-1/2",
                // Desktop: top-right
                "sm:left-auto sm:right-[var(--space-4)] sm:top-[calc(env(safe-area-inset-top)+var(--space-4))] sm:translate-x-0",
              )}
            >
              {visible.map((t) => (
                <ToastItem key={t.id} record={t} onDismiss={() => dismiss(t.id)} />
              ))}
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext)
  if (!ctx) {
    throw new Error("useToast must be used within <ToastProvider>")
  }
  return ctx
}

interface ToastItemProps {
  record: ToastRecord
  onDismiss: () => void
}

function ToastItem({ record, onDismiss }: ToastItemProps) {
  const [entered, setEntered] = React.useState(false)
  const [leaving, setLeaving] = React.useState(false)
  const [dragX, setDragX] = React.useState(0)
  const startXRef = React.useRef<number | null>(null)
  const dismissedRef = React.useRef(false)

  const assertive = record.variant === "warning" || record.variant === "danger"
  const { icon: VariantIcon, iconClass, wrapper } = variantStyles[record.variant]

  const close = React.useCallback(() => {
    if (dismissedRef.current) return
    dismissedRef.current = true
    setLeaving(true)
    window.setTimeout(onDismiss, 220)
  }, [onDismiss])

  React.useEffect(() => {
    const t = window.setTimeout(() => setEntered(true), 10)
    return () => window.clearTimeout(t)
  }, [])

  React.useEffect(() => {
    if (record.duration <= 0) return
    const t = window.setTimeout(close, record.duration)
    return () => window.clearTimeout(t)
  }, [close, record.duration])

  function onTouchStart(e: React.TouchEvent) {
    startXRef.current = e.touches[0]?.clientX ?? null
  }
  function onTouchMove(e: React.TouchEvent) {
    if (startXRef.current == null) return
    const dx = (e.touches[0]?.clientX ?? 0) - startXRef.current
    if (dx > 0) setDragX(dx)
  }
  function onTouchEnd() {
    if (dragX > 80) {
      close()
    } else {
      setDragX(0)
    }
    startXRef.current = null
  }

  const transform = leaving
    ? "translate3d(110%, 0, 0)"
    : entered
      ? `translate3d(${dragX}px, 0, 0)`
      : "translate3d(0, -20px, 0)"

  const opacity = leaving ? 0 : entered ? Math.max(0, 1 - dragX / 200) : 0

  return (
    <div
      role={assertive ? "alert" : "status"}
      aria-live={assertive ? "assertive" : "polite"}
      aria-atomic="true"
      data-slot="toast"
      data-variant={record.variant}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{
        transform,
        opacity,
        transitionProperty: "transform, opacity",
        transitionDuration: "var(--duration-slow)",
        transitionTimingFunction: "var(--ease-spring)",
      }}
      className={cn(
        "pointer-events-auto flex w-full items-start gap-[var(--space-3)]",
        "rounded-[var(--radius-md)] border border-[color:var(--color-border)] py-[var(--space-3)] pl-[var(--space-4)] pr-[var(--space-3)]",
        "shadow-[var(--shadow-mid)] text-[color:var(--color-text)]",
        "group",
        wrapper,
      )}
    >
      <VariantIcon className={cn("mt-[2px] h-5 w-5 shrink-0", iconClass)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="text-[length:var(--type-subhead-size)] font-[var(--weight-semibold)] leading-[var(--type-line-height-snug)]">
          {record.title}
        </div>
        {record.description ? (
          <div className="mt-[var(--space-1)] text-[length:var(--type-footnote-size)] leading-[var(--type-line-height-normal)] text-[color:var(--color-text-muted)]">
            {record.description}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={close}
        aria-label="Dismiss notification"
        className={cn(
          "btn-press inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)]",
          "text-[color:var(--color-text-muted)] opacity-0 transition-opacity duration-[var(--duration-quick)] ease-[var(--ease-out)]",
          "hover:bg-[color:var(--color-surface-hover)] hover:text-[color:var(--color-text)]",
          "focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-border-focus)]",
          "group-hover:opacity-100",
        )}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}

export default ToastProvider

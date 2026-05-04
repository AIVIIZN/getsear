"use client"

/**
 * ConfirmDialog — yes/no confirmation built on @base-ui/react/alert-dialog.
 *
 * Sister 6.1.3 ships <Modal /> in a separate worktree; once both batches merge,
 * ConfirmDialog should be reworked to compose <Modal> for a single visual source
 * of truth. Until then, this file owns its own backdrop/popup styling tuned to
 * match the V6 spec exactly.
 */

import * as React from "react"
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog"

import { cn } from "@/lib/utils"

export type ConfirmDialogVariant = "default" | "destructive"

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: ConfirmDialogVariant
  loading?: boolean
  onConfirm: () => void | Promise<void>
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [pending, setPending] = React.useState(false)
  const isPending = loading || pending

  async function handleConfirm() {
    try {
      setPending(true)
      await onConfirm()
      onOpenChange(false)
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Backdrop
          className={cn(
            "frosted-backdrop fixed inset-0 z-[var(--z-overlay)]",
            "transition-opacity duration-[var(--duration-base)] ease-[var(--ease-out)]",
            "data-starting-style:opacity-0 data-ending-style:opacity-0",
          )}
        />
        <AlertDialogPrimitive.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-[var(--z-modal)] w-[calc(100%-var(--space-8))] max-w-md",
            "-translate-x-1/2 -translate-y-1/2",
            "flex flex-col gap-[var(--space-5)]",
            "rounded-[var(--radius-lg)] bg-[color:var(--color-surface)] text-[color:var(--color-text)]",
            "p-[var(--space-6)] shadow-[var(--shadow-modal)] outline-none",
            "transition-[transform,opacity] duration-[var(--duration-slow)] ease-[var(--ease-spring)]",
            "data-starting-style:opacity-0 data-starting-style:[transform:translate(-50%,-50%)_scale(0.94)]",
            "data-ending-style:opacity-0 data-ending-style:[transform:translate(-50%,-50%)_scale(0.94)]",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-border-focus)]",
          )}
        >
          <div className="flex flex-col gap-[var(--space-2)]">
            <AlertDialogPrimitive.Title
              className={cn(
                "text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)]",
                "leading-[var(--type-line-height-snug)] text-[color:var(--color-text)]",
              )}
            >
              {title}
            </AlertDialogPrimitive.Title>
            {description ? (
              <AlertDialogPrimitive.Description
                className={cn(
                  "text-[length:var(--type-body-size)] leading-[var(--type-line-height-normal)]",
                  "text-[color:var(--color-text-muted)]",
                )}
              >
                {description}
              </AlertDialogPrimitive.Description>
            ) : null}
          </div>
          <div className="flex flex-row-reverse items-center gap-[var(--space-3)]">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isPending}
              data-variant={variant}
              className={cn(
                "btn-press touch-target inline-flex min-w-[96px] items-center justify-center",
                "rounded-[var(--radius-sm)] px-[var(--space-5)]",
                "text-[length:var(--type-callout-size)] font-[var(--weight-semibold)]",
                "transition-colors duration-[var(--duration-quick)] ease-[var(--ease-out)]",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-border-focus)]",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                variant === "destructive"
                  ? "bg-[color:var(--color-danger-strong)] text-[color:var(--color-primary-fg)] hover:bg-[color:var(--color-danger)] active:brightness-95"
                  : "bg-[color:var(--color-primary)] text-[color:var(--color-primary-fg)] hover:bg-[color:var(--color-primary-hover)] active:bg-[color:var(--color-primary-active)]",
              )}
            >
              {isPending ? "Working..." : confirmLabel}
            </button>
            <AlertDialogPrimitive.Close
              disabled={isPending}
              className={cn(
                "btn-press touch-target inline-flex min-w-[96px] items-center justify-center",
                "rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-[var(--space-5)]",
                "bg-[color:var(--color-surface)] text-[color:var(--color-text)]",
                "text-[length:var(--type-callout-size)] font-[var(--weight-medium)]",
                "transition-colors duration-[var(--duration-quick)] ease-[var(--ease-out)]",
                "hover:bg-[color:var(--color-surface-hover)]",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-border-focus)]",
                "disabled:opacity-40 disabled:cursor-not-allowed",
              )}
            >
              {cancelLabel}
            </AlertDialogPrimitive.Close>
          </div>
        </AlertDialogPrimitive.Popup>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  )
}

export default ConfirmDialog

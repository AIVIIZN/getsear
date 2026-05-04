"use client"

import * as React from "react"
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type SheetSide = "right" | "left" | "bottom"
type SheetWidth = "sm" | "md" | "lg"

const widthClass: Record<SheetWidth, string> = {
  sm: "sm:max-w-[320px]",
  md: "sm:max-w-[400px]",
  lg: "sm:max-w-[560px]",
}

const sideClass: Record<SheetSide, string> = {
  right:
    "inset-y-0 right-0 h-full w-full border-l border-[color:var(--color-border)] data-starting-style:translate-x-full data-ending-style:translate-x-full",
  left: "inset-y-0 left-0 h-full w-full border-r border-[color:var(--color-border)] data-starting-style:-translate-x-full data-ending-style:-translate-x-full",
  bottom:
    "inset-x-0 bottom-0 h-auto w-full border-t border-[color:var(--color-border)] data-starting-style:translate-y-full data-ending-style:translate-y-full",
}

function Sheet(props: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger(props: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose(props: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal(props: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetBackdrop({
  className,
  ...props
}: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-backdrop"
      className={cn(
        "frosted-backdrop fixed inset-0 z-[var(--z-overlay)]",
        "transition-opacity duration-[var(--duration-base)] ease-[var(--ease-out)]",
        "data-starting-style:opacity-0 data-ending-style:opacity-0",
        className,
      )}
      {...props}
    />
  )
}

export interface SheetContentProps extends SheetPrimitive.Popup.Props {
  side?: SheetSide
  width?: SheetWidth
  showCloseButton?: boolean
}

function SheetContent({
  className,
  children,
  side = "right",
  width = "md",
  showCloseButton = true,
  ...props
}: SheetContentProps) {
  return (
    <SheetPortal>
      <SheetBackdrop />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        data-side={side}
        data-width={width}
        className={cn(
          "fixed z-[var(--z-modal)] flex flex-col bg-[color:var(--color-surface)] text-[color:var(--color-text)]",
          "shadow-[var(--shadow-modal)] outline-none",
          "transition-transform duration-[var(--duration-slow)] ease-[var(--ease-spring)]",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-border-focus)]",
          sideClass[side],
          side !== "bottom" && widthClass[width],
          side !== "bottom" && "rounded-l-[var(--radius-lg)]",
          side === "left" && "rounded-r-[var(--radius-lg)] rounded-l-none",
          side === "bottom" && "rounded-t-[var(--radius-lg)]",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot="sheet-close-icon"
            aria-label="Close"
            className={cn(
              "btn-press touch-target absolute right-[var(--space-3)] top-[var(--space-3)]",
              "inline-flex items-center justify-center rounded-[var(--radius-sm)]",
              "text-[color:var(--color-text-muted)]",
              "transition-colors duration-[var(--duration-quick)] ease-[var(--ease-out)]",
              "hover:bg-[color:var(--color-surface-hover)] hover:text-[color:var(--color-text)]",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-border-focus)]",
            )}
          >
            <XIcon className="size-5" aria-hidden="true" />
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn(
        "flex flex-col gap-[var(--space-1)] border-b border-[color:var(--color-border)]",
        "px-[var(--space-6)] py-[var(--space-5)] pr-[var(--space-12)]",
        className,
      )}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "text-[length:var(--type-title-2-size)] font-[number:var(--weight-semibold)] leading-[var(--type-line-height-snug)] text-[color:var(--color-text)]",
        className,
      )}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn(
        "text-[length:var(--type-body-size)] leading-[var(--type-line-height-normal)] text-[color:var(--color-text-muted)]",
        className,
      )}
      {...props}
    />
  )
}

function SheetBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="sheet-body"
      className={cn(
        "flex-1 overflow-y-auto px-[var(--space-6)] py-[var(--space-5)]",
        "[padding-bottom:max(var(--space-5),env(safe-area-inset-bottom))]",
        className,
      )}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        "flex flex-col-reverse gap-[var(--space-2)] border-t border-[color:var(--color-border)]",
        "px-[var(--space-6)] py-[var(--space-4)]",
        "sm:flex-row sm:items-center sm:justify-end",
        "[padding-bottom:max(var(--space-4),env(safe-area-inset-bottom))]",
        className,
      )}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetPortal,
  SheetBackdrop,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
}
export default Sheet

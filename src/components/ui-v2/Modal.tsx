"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type ModalSize = "sm" | "md" | "lg" | "full"

const sizeClass: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  full: "max-w-[90vw]",
}

function Modal(props: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="modal" {...props} />
}

function ModalTrigger(props: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="modal-trigger" {...props} />
}

function ModalClose(props: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="modal-close" {...props} />
}

function ModalPortal(props: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="modal-portal" {...props} />
}

function ModalBackdrop({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="modal-backdrop"
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

export interface ModalContentProps extends DialogPrimitive.Popup.Props {
  size?: ModalSize
  showCloseButton?: boolean
}

function ModalContent({
  className,
  children,
  size = "md",
  showCloseButton = true,
  ...props
}: ModalContentProps) {
  return (
    <ModalPortal>
      <ModalBackdrop />
      <DialogPrimitive.Popup
        data-slot="modal-content"
        data-size={size}
        className={cn(
          "fixed left-1/2 top-1/2 z-[var(--z-modal)] w-[calc(100%-var(--space-8))]",
          "-translate-x-1/2 -translate-y-1/2",
          "flex flex-col gap-[var(--space-5)]",
          "rounded-[var(--radius-lg)] bg-[color:var(--color-surface)] text-[color:var(--color-text)]",
          "p-[var(--space-6)] shadow-[var(--shadow-modal)] outline-none",
          "transition-[transform,opacity] duration-[var(--duration-slow)] ease-[var(--ease-spring)]",
          "data-starting-style:opacity-0 data-starting-style:[transform:translate(-50%,-50%)_scale(0.94)]",
          "data-ending-style:opacity-0 data-ending-style:[transform:translate(-50%,-50%)_scale(0.94)]",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-border-focus)]",
          sizeClass[size],
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="modal-close-icon"
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
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </ModalPortal>
  )
}

function ModalHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="modal-header"
      className={cn("flex flex-col gap-[var(--space-1)] pr-[var(--space-8)]", className)}
      {...props}
    />
  )
}

function ModalTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="modal-title"
      className={cn(
        "text-[length:var(--type-title-2-size)] font-[number:var(--weight-semibold)] leading-[var(--type-line-height-snug)] text-[color:var(--color-text)]",
        className,
      )}
      {...props}
    />
  )
}

function ModalDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="modal-description"
      className={cn(
        "text-[length:var(--type-body-size)] leading-[var(--type-line-height-normal)] text-[color:var(--color-text-muted)]",
        className,
      )}
      {...props}
    />
  )
}

function ModalBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="modal-body"
      className={cn(
        "flex flex-col gap-[var(--space-4)] text-[length:var(--type-body-size)] text-[color:var(--color-text)]",
        className,
      )}
      {...props}
    />
  )
}

function ModalFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="modal-footer"
      className={cn(
        "flex flex-col-reverse gap-[var(--space-2)] sm:flex-row sm:items-center sm:justify-end",
        className,
      )}
      {...props}
    />
  )
}

export {
  Modal,
  ModalTrigger,
  ModalClose,
  ModalPortal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
}
export default Modal

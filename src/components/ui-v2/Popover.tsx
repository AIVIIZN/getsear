"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"

import { cn } from "@/lib/utils"

function Popover(props: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger(props: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverClose(props: PopoverPrimitive.Close.Props) {
  return <PopoverPrimitive.Close data-slot="popover-close" {...props} />
}

export interface PopoverContentProps extends PopoverPrimitive.Popup.Props {
  align?: PopoverPrimitive.Positioner.Props["align"]
  alignOffset?: PopoverPrimitive.Positioner.Props["alignOffset"]
  side?: PopoverPrimitive.Positioner.Props["side"]
  sideOffset?: PopoverPrimitive.Positioner.Props["sideOffset"]
  showArrow?: boolean
}

function PopoverContent({
  className,
  align = "center",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 6,
  showArrow = false,
  children,
  ...props
}: PopoverContentProps) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-[var(--z-popover)] outline-none"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "min-w-[var(--space-20)] max-w-[320px]",
            "rounded-[var(--radius-md)] bg-[color:var(--color-surface)] text-[color:var(--color-text)]",
            "border border-[color:var(--color-border)] shadow-[var(--shadow-mid)] outline-none",
            "p-[var(--space-3)] text-[length:var(--type-subhead-size)]",
            "transition-[transform,opacity] duration-[var(--duration-base)] ease-[var(--ease-spring)]",
            "data-starting-style:opacity-0 data-starting-style:scale-95",
            "data-ending-style:opacity-0 data-ending-style:scale-95",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-border-focus)]",
            className,
          )}
          {...props}
        >
          {showArrow && (
            <PopoverPrimitive.Arrow
              data-slot="popover-arrow"
              className="text-[color:var(--color-surface)]"
            >
              <svg width="14" height="7" viewBox="0 0 14 7" aria-hidden="true">
                <path
                  d="M0 0 L7 7 L14 0 Z"
                  fill="currentColor"
                  stroke="var(--color-border)"
                  strokeWidth="1"
                />
              </svg>
            </PopoverPrimitive.Arrow>
          )}
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

function PopoverHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="popover-header"
      className={cn("flex flex-col gap-[var(--space-1)]", className)}
      {...props}
    />
  )
}

function PopoverTitle({ className, ...props }: PopoverPrimitive.Title.Props) {
  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      className={cn(
        "text-[length:var(--type-headline-size)] font-[number:var(--weight-semibold)] leading-[var(--type-line-height-snug)] text-[color:var(--color-text)]",
        className,
      )}
      {...props}
    />
  )
}

function PopoverDescription({
  className,
  ...props
}: PopoverPrimitive.Description.Props) {
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      className={cn(
        "text-[length:var(--type-subhead-size)] leading-[var(--type-line-height-normal)] text-[color:var(--color-text-muted)]",
        className,
      )}
      {...props}
    />
  )
}

export {
  Popover,
  PopoverTrigger,
  PopoverClose,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
}
export default Popover

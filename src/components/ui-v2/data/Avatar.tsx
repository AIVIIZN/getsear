"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/*
 * Sear POS UI v2 — Avatar
 * Spec: docs/design/UI_V2_COMPONENT_SPEC.md universal rules + V6_VISUAL 6.1.4
 *
 * Sizes (px): xs=24, sm=32, md=40, lg=56, xl=72
 * Renders <img> when `src` provided + load succeeds; otherwise falls back to
 * initials derived from `name` (first 2 word-initials, uppercased).
 *
 * Initials background is var(--color-bg-muted); fg is var(--color-text-muted).
 */

const avatarVariants = cva(
  cn(
    "relative inline-flex items-center justify-center overflow-hidden select-none",
    "rounded-[var(--radius-circle)]",
    "bg-[var(--color-bg-muted)] text-[var(--color-text-muted)]",
    "font-[var(--font-system)] font-[var(--weight-semibold)] leading-none",
    "border border-[var(--color-border)]",
  ),
  {
    variants: {
      size: {
        xs: "h-[24px] w-[24px] text-[10px]",
        sm: "h-[32px] w-[32px] text-[12px]",
        md: "h-[40px] w-[40px] text-[14px]",
        lg: "h-[56px] w-[56px] text-[18px]",
        xl: "h-[72px] w-[72px] text-[24px]",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
)

type AvatarVariantProps = VariantProps<typeof avatarVariants>

export interface AvatarProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "color">,
    AvatarVariantProps {
  src?: string | null
  alt?: string
  name?: string
}

function getInitials(name?: string): string {
  if (!name) return ""
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ""
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const Avatar = React.forwardRef<HTMLSpanElement, AvatarProps>(
  function Avatar({ className, size, src, alt, name, ...props }, ref) {
    const [imgFailed, setImgFailed] = React.useState(false)
    const showImage = !!src && !imgFailed
    const initials = getInitials(name)

    return (
      <span
        ref={ref}
        data-size={size ?? "md"}
        aria-label={alt ?? name ?? undefined}
        className={cn(avatarVariants({ size }), className)}
        {...props}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src ?? ""}
            alt={alt ?? name ?? ""}
            className="h-full w-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span aria-hidden="true">{initials}</span>
        )}
      </span>
    )
  },
)

export { Avatar, avatarVariants }
export default Avatar

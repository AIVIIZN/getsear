"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Badge, type BadgeProps } from "./Badge"

/*
 * Sear POS UI v2 — Pill
 * Spec: docs/design/UI_V2_COMPONENT_SPEC.md universal rules + V6_VISUAL 6.1.4
 *
 * Pill is the rounded-full Badge variant for status (orders, tables, tickets).
 * Defaults to size="md" + shape="pill" so callers get the right shape with
 * minimal props. Forwards all other Badge props.
 */

export type PillProps = Omit<BadgeProps, "shape">

const Pill = React.forwardRef<HTMLSpanElement, PillProps>(
  function Pill({ className, ...props }, ref) {
    return <Badge ref={ref} shape="pill" className={cn(className)} {...props} />
  },
)

export { Pill }
export default Pill

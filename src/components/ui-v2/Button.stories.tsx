/*
 * Sear POS UI v2 — Button stories
 *
 * @storybook/* is not installed yet (will be wired in V7 reliability batch).
 * These stories use the CSF3 shape with light type-side type so the file
 * compiles in the meantime. They will render unchanged once Storybook is wired in.
 */

import * as React from "react"

import { Button } from "./Button"

/* Local stand-in types so this file compiles before @storybook/* lands. */
type Meta<T> = {
  title: string
  component: T
  parameters?: Record<string, unknown>
  argTypes?: Record<string, unknown>
  args?: Record<string, unknown>
  tags?: string[]
}
type StoryObj<T> = {
  name?: string
  args?: Partial<React.ComponentProps<T extends React.ComponentType<infer P> ? React.ComponentType<P> : never>>
  render?: (args: unknown) => React.ReactElement
}

const meta: Meta<typeof Button> = {
  title: "UI v2/Button",
  component: Button,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: { type: "select" },
      options: ["primary", "secondary", "ghost", "destructive"],
    },
    size: {
      control: { type: "select" },
      options: ["sm", "md", "lg", "xl"],
    },
    loading: { control: { type: "boolean" } },
    disabled: { control: { type: "boolean" } },
  },
  args: {
    children: "Button",
    variant: "primary",
    size: "lg",
    loading: false,
    disabled: false,
  },
}

export default meta

type Story = StoryObj<typeof Button>

/* ─── Single-prop stories ──────────────────────────────────────────────── */

export const Primary: Story = { args: { variant: "primary", children: "Send to kitchen" } }
export const Secondary: Story = { args: { variant: "secondary", children: "Cancel" } }
export const Ghost: Story = { args: { variant: "ghost", children: "Skip" } }
export const Destructive: Story = { args: { variant: "destructive", children: "Void order" } }

export const SizeSm: Story = { args: { size: "sm", children: "Back-office sm (32pt)" } }
export const SizeMd: Story = { args: { size: "md", children: "Back-office md (40pt)" } }
export const SizeLg: Story = { args: { size: "lg", children: "POS lg (44pt)" } }
export const SizeXl: Story = { args: { size: "xl", children: "POS xl CTA (52pt)" } }

export const Loading: Story = { args: { loading: true, children: "Saving" } }
export const Disabled: Story = { args: { disabled: true, children: "Disabled" } }

/* ─── Combinatoric matrix: every variant × every size ─────────────────── */

const VARIANTS = ["primary", "secondary", "ghost", "destructive"] as const
const SIZES = ["sm", "md", "lg", "xl"] as const

export const VariantSizeMatrix: Story = {
  name: "Matrix — variant × size",
  render: () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `auto repeat(${SIZES.length}, minmax(0, 1fr))`,
        gap: "var(--space-4)",
        padding: "var(--space-6)",
        background: "var(--color-bg)",
        alignItems: "center",
      }}
    >
      <div />
      {SIZES.map((s) => (
        <div
          key={`h-${s}`}
          style={{
            fontSize: "var(--type-caption-1-size)",
            color: "var(--color-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {s}
        </div>
      ))}
      {VARIANTS.map((v) => (
        <React.Fragment key={`row-${v}`}>
          <div
            style={{
              fontSize: "var(--type-caption-1-size)",
              color: "var(--color-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {v}
          </div>
          {SIZES.map((s) => (
            <Button key={`${v}-${s}`} variant={v} size={s}>
              {v}
            </Button>
          ))}
        </React.Fragment>
      ))}
    </div>
  ),
}

/* ─── Combinatoric matrix: every variant × every state ────────────────── */

const STATES = [
  "default",
  "hover",
  "active",
  "focus-visible",
  "disabled",
  "loading",
] as const

type StateName = (typeof STATES)[number]

function StateButton({
  variant,
  state,
}: {
  variant: (typeof VARIANTS)[number]
  state: StateName
}) {
  const props: React.ComponentProps<typeof Button> = { variant, size: "lg" }
  if (state === "disabled") props.disabled = true
  if (state === "loading") props.loading = true
  // hover/active/focus-visible are visual-only; users toggle via dev tools.
  // We tag the button via data-* so review tooling can drive the pseudo-state.
  return (
    <Button {...props} data-story-state={state}>
      {state}
    </Button>
  )
}

export const VariantStateMatrix: Story = {
  name: "Matrix — variant × state",
  render: () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `auto repeat(${STATES.length}, minmax(0, 1fr))`,
        gap: "var(--space-4)",
        padding: "var(--space-6)",
        background: "var(--color-bg)",
        alignItems: "center",
      }}
    >
      <div />
      {STATES.map((s) => (
        <div
          key={`hh-${s}`}
          style={{
            fontSize: "var(--type-caption-1-size)",
            color: "var(--color-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {s}
        </div>
      ))}
      {VARIANTS.map((v) => (
        <React.Fragment key={`srow-${v}`}>
          <div
            style={{
              fontSize: "var(--type-caption-1-size)",
              color: "var(--color-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {v}
          </div>
          {STATES.map((s) => (
            <StateButton key={`${v}-${s}`} variant={v} state={s} />
          ))}
        </React.Fragment>
      ))}
    </div>
  ),
}

/* ─── With icons ──────────────────────────────────────────────────────── */

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export const WithLeadingIcon: Story = {
  args: { leadingIcon: <PlusIcon />, children: "Add item" },
}
export const WithTrailingIcon: Story = {
  args: { trailingIcon: <ArrowRightIcon />, children: "Continue" },
}
export const LoadingPreservesLabel: Story = {
  name: "Loading — label preserved",
  args: { loading: true, leadingIcon: <PlusIcon />, children: "Sending" },
}

/**
 * Order state machine (XState v5).
 *
 * Declares every legal order state + transition for Sear POS. Server-side guard
 * for the order lifecycle: any code path that mutates `orders.status` should
 * route the transition through `assertTransition()` so illegal moves throw
 * with a clear, auditable error instead of silently corrupting the order.
 *
 * The 8 canonical states mirror the `public.order_status` Postgres enum:
 *   draft -> open -> fired -> ready -> served -> closed -> (refunded | reopened)
 *                                                          \-> voided (any state, with reason)
 *
 * Edge cases the machine encodes:
 *   - Comp issued AFTER an order is closed/paid:
 *       closed --COMP_AFTER_CLOSE--> served (re-open to allow comp), then
 *       follow normal path back to closed when payment delta is settled.
 *   - Void after close:
 *       closed --VOID_AFTER_CLOSE--> voided (manager-PIN required, enforced
 *       at the route layer; the machine merely permits the transition).
 *   - Refunds:
 *       closed --REFUND--> closed   (partial; balance > 0 stays owed)
 *       closed --REFUND_FULL--> refunded
 *
 * The machine is intentionally pure: no Supabase, no I/O. Routes assemble
 * the context, ask the machine "is this legal?", then perform the DB write.
 */

import { createMachine, assign, type AnyEventObject } from 'xstate'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OrderState =
  | 'draft'
  | 'open'
  | 'fired'
  | 'ready'
  | 'served'
  | 'closed'
  | 'voided'
  | 'refunded'

export type OrderEvent =
  | { type: 'SUBMIT' }                               // draft -> open
  | { type: 'FIRE' }                                 // open -> fired (sent to kitchen)
  | { type: 'MARK_READY' }                           // fired -> ready
  | { type: 'SERVE' }                                // ready -> served
  | { type: 'CLOSE'; balance_due_cents: number }     // served -> closed (payment received)
  | { type: 'REOPEN' }                               // closed -> served (manager-only)
  | { type: 'VOID'; reason: string }                 // any non-terminal -> voided
  | { type: 'VOID_AFTER_CLOSE'; reason: string; manager_pin_verified: boolean }
  | { type: 'COMP_AFTER_CLOSE'; reason: string; manager_pin_verified: boolean }
  | { type: 'REFUND'; amount_cents: number }         // closed -> closed (partial)
  | { type: 'REFUND_FULL' }                          // closed -> refunded

export interface OrderContext {
  /** Total balance owed in cents. Used by guards to decide partial vs full state changes. */
  balance_due_cents: number
  /** Total tip in cents. Tracked so refund-of-tip-only is auditable. */
  tip_cents: number
  /** Set true when the machine re-opens a closed order to apply a comp. */
  reopened_for_comp: boolean
}

// ---------------------------------------------------------------------------
// Pure transition table — used by `assertTransition` for synchronous validation
// without spinning up an actor. Maps state -> allowed event types.
// ---------------------------------------------------------------------------

export const ALLOWED_TRANSITIONS: Record<OrderState, OrderEvent['type'][]> = {
  draft: ['SUBMIT', 'VOID'],
  open: ['FIRE', 'VOID'],
  fired: ['MARK_READY', 'VOID'],
  ready: ['SERVE', 'VOID'],
  served: ['CLOSE', 'VOID'],
  closed: ['REOPEN', 'VOID_AFTER_CLOSE', 'COMP_AFTER_CLOSE', 'REFUND', 'REFUND_FULL'],
  voided: [], // terminal
  refunded: [], // terminal
}

/**
 * Resolve the next state for a given (currentState, event) pair.
 * Returns `null` if the transition is illegal.
 *
 * Kept in lockstep with the XState machine below; both are exported and
 * cross-referenced in unit tests so the lookup table never drifts.
 */
export function nextState(
  current: OrderState,
  event: OrderEvent
): OrderState | null {
  const allowed = ALLOWED_TRANSITIONS[current]
  if (!allowed.includes(event.type)) return null

  switch (event.type) {
    case 'SUBMIT':
      return 'open'
    case 'FIRE':
      return 'fired'
    case 'MARK_READY':
      return 'ready'
    case 'SERVE':
      return 'served'
    case 'CLOSE':
      return event.balance_due_cents <= 0 ? 'closed' : 'served'
    case 'REOPEN':
      return 'served'
    case 'VOID':
      return 'voided'
    case 'VOID_AFTER_CLOSE':
      return event.manager_pin_verified ? 'voided' : current
    case 'COMP_AFTER_CLOSE':
      // Re-open to apply the comp; route layer drives it back to `closed`
      // once the comp + payment delta are reconciled.
      return event.manager_pin_verified ? 'served' : current
    case 'REFUND':
      return 'closed' // partial refund — order remains in closed terminal-ish state
    case 'REFUND_FULL':
      return 'refunded'
  }
}

/**
 * Throw if the (state, event) pair is not a legal transition.
 *
 * Routes call this BEFORE writing to Postgres. The thrown error is caught
 * by the route's try/catch and translated to a 422 with a clear message —
 * never a 500, since these are user-input errors, not server bugs.
 */
export class IllegalTransitionError extends Error {
  readonly currentState: OrderState
  readonly event: OrderEvent['type']
  constructor(currentState: OrderState, event: OrderEvent['type']) {
    super(
      `Illegal order transition: cannot fire "${event}" from state "${currentState}". ` +
        `Allowed events from "${currentState}": [${ALLOWED_TRANSITIONS[currentState].join(', ') || 'none (terminal state)'}]`
    )
    this.name = 'IllegalTransitionError'
    this.currentState = currentState
    this.event = event
  }
}

export function assertTransition(
  current: OrderState,
  event: OrderEvent
): OrderState {
  const next = nextState(current, event)
  if (next === null) {
    throw new IllegalTransitionError(current, event.type)
  }
  return next
}

// ---------------------------------------------------------------------------
// XState v5 machine — used by tests and any UI that wants to drive the order
// through transitions optimistically (e.g. KDS prefetch).
// ---------------------------------------------------------------------------

export const orderMachine = createMachine({
  id: 'order',
  types: {} as {
    context: OrderContext
    events: OrderEvent
  },
  initial: 'draft',
  context: {
    balance_due_cents: 0,
    tip_cents: 0,
    reopened_for_comp: false,
  },
  states: {
    draft: {
      on: {
        SUBMIT: { target: 'open' },
        VOID: { target: 'voided' },
      },
    },
    open: {
      on: {
        FIRE: { target: 'fired' },
        VOID: { target: 'voided' },
      },
    },
    fired: {
      on: {
        MARK_READY: { target: 'ready' },
        VOID: { target: 'voided' },
      },
    },
    ready: {
      on: {
        SERVE: { target: 'served' },
        VOID: { target: 'voided' },
      },
    },
    served: {
      on: {
        CLOSE: [
          {
            target: 'closed',
            guard: ({ event }: { event: AnyEventObject }) =>
              (event as unknown as { balance_due_cents: number }).balance_due_cents <= 0,
            actions: assign({
              balance_due_cents: () => 0,
              reopened_for_comp: () => false,
            }),
          },
          // Partial payment leaves order in `served` (must finish paying).
          { target: 'served' },
        ],
        VOID: { target: 'voided' },
      },
    },
    closed: {
      on: {
        REOPEN: {
          target: 'served',
        },
        VOID_AFTER_CLOSE: {
          target: 'voided',
          guard: ({ event }: { event: AnyEventObject }) =>
            (event as unknown as { manager_pin_verified: boolean }).manager_pin_verified === true,
        },
        COMP_AFTER_CLOSE: {
          target: 'served',
          guard: ({ event }: { event: AnyEventObject }) =>
            (event as unknown as { manager_pin_verified: boolean }).manager_pin_verified === true,
          actions: assign({
            reopened_for_comp: () => true,
          }),
        },
        REFUND: {
          target: 'closed', // partial — stays closed
        },
        REFUND_FULL: {
          target: 'refunded',
        },
      },
    },
    voided: {
      type: 'final',
    },
    refunded: {
      type: 'final',
    },
  },
})

// ---------------------------------------------------------------------------
// Helpers used by the route layer
// ---------------------------------------------------------------------------

/**
 * Returns true if the given state is "post-close" — meaning the order has
 * already been paid and any further mutation is privileged (comp/void/refund).
 */
export function isPostClose(state: OrderState): boolean {
  return state === 'closed' || state === 'refunded'
}

/**
 * Returns true if the state is terminal (no further transitions allowed).
 */
export function isTerminal(state: OrderState): boolean {
  return state === 'voided' || state === 'refunded'
}

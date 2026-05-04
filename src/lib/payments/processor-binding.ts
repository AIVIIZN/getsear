/**
 * Processor binding — single source of truth for which payment processor an
 * org is bound to. Sear's business model is processor-locked: each org gets
 * one assigned processor (Valor at launch); switching is forbidden by
 * contract and must be impossible by software.
 *
 * Defense in depth (3 layers):
 *   1. TypeScript — `Processor` is a const literal type, not a string union.
 *      Adding another processor requires a code change reviewed by Sear.
 *   2. Database — `org_processor_bindings` is INSERT-only via a BEFORE UPDATE
 *      trigger that raises if `processor` changes. (Sister task 5.2.0a.)
 *   3. No UI surface — no "Switch Processor" control anywhere in the app.
 *
 * This module is the runtime read path. Reads use the service-role client so
 * the framework works cross-cutting (RLS-aware admin reads need to succeed
 * regardless of the calling user's role).
 */

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Processor — const literal type. Day-1 only Valor is supported.
 *
 * Verification: `const p: Processor = 'stripe'` produces a TypeScript error
 * (literal type mismatch). Acceptance criterion 5.2.0/100.
 */
export type Processor = 'valor'

export interface ProcessorBinding {
  org_id: string
  processor: Processor
  /** ISO-8601 timestamp */
  bound_at: string
  bound_by_user_id: string | null
}

/**
 * Read the processor binding for an org. Returns `null` if no binding exists
 * yet (e.g., a freshly created org before the backfill row lands).
 *
 * Fallback: if the `org_processor_bindings` table doesn't exist yet (sister
 * task 5.2.0a hasn't merged), returns a synthesized binding pointing at Valor
 * with a console.warn. This lets the rest of the framework function while the
 * migration is in flight. Once 5.2.0a lands, this fallback path stops firing.
 */
export async function getProcessorBinding(
  org_id: string
): Promise<ProcessorBinding | null> {
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('org_processor_bindings') as any)
    .select('org_id, processor, bound_at, bound_by_user_id')
    .eq('org_id', org_id)
    .maybeSingle()

  if (error) {
    // Postgres error 42P01 = undefined_table. Distinguish "table missing" from
    // other failures so we only fall back when the migration genuinely hasn't
    // landed yet.
    const code = (error as { code?: string }).code
    if (code === '42P01') {
      console.warn(
        '[processor-binding] org_processor_bindings table missing; ' +
          'falling back to default Valor binding. Migration 5.2.0a expected to land soon.'
      )
      return {
        org_id,
        processor: 'valor',
        bound_at: new Date().toISOString(),
        bound_by_user_id: null,
      }
    }
    // Any other error is a real failure — surface it.
    console.error('[processor-binding] read failed:', error)
    return null
  }

  if (!data) return null

  // Validate the processor value at the boundary. The DB CHECK constraint
  // should already enforce this, but a malformed row would crash callers.
  const row = data as { org_id: string; processor: string; bound_at: string; bound_by_user_id: string | null }
  if (row.processor !== 'valor') {
    console.error(
      `[processor-binding] org ${org_id} has unsupported processor '${row.processor}'; ` +
        'returning null. Update the Processor type and the compatibility matrix to add support.'
    )
    return null
  }

  return {
    org_id: row.org_id,
    processor: 'valor',
    bound_at: row.bound_at,
    bound_by_user_id: row.bound_by_user_id,
  }
}

/**
 * Read the processor binding or throw. Use this in code paths that cannot
 * meaningfully proceed without a binding (registering a terminal, processing
 * a payment, etc.).
 */
export async function requireProcessorBinding(
  org_id: string
): Promise<ProcessorBinding> {
  const binding = await getProcessorBinding(org_id)
  if (!binding) {
    throw new Error(
      `No processor binding for org ${org_id}. Onboarding incomplete or binding row missing.`
    )
  }
  return binding
}

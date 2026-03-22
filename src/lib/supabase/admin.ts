import { createClient } from '@supabase/supabase-js'

/**
 * Admin Supabase client that bypasses Row-Level Security.
 * Uses the service_role key — NEVER import this in client components.
 * Only use in Route Handlers, Server Actions, and server-side utilities.
 *
 * Note: Untyped until we generate Supabase types with `supabase gen types`.
 * All queries return `any` — validate with zod at the boundary.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

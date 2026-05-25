import { createClient } from '@supabase/supabase-js'

/**
 * Admin Supabase client that bypasses Row-Level Security.
 * Uses the service_role key — NEVER import this in client components.
 * Only use in Route Handlers, Server Actions, and server-side utilities.
 *
 * Kept structurally flexible because several route groups still reference
 * future-schema tables. Route handlers validate untrusted input and response
 * shapes at their own boundaries.
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

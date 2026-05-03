/**
 * Reset script for Sear POS — drops all seed data and re-seeds.
 * Run with: npx tsx src/scripts/reset.ts
 *
 * WARNING: This deletes ALL data for the seed org. For development only.
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'
import { execSync } from 'child_process'

// Load .env.local from project root
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local'
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const ORG_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

/**
 * Delete all data belonging to the seed org, in dependency order.
 * Tables without org_id (join tables) are cleaned via cascading deletes
 * or explicit cleanup.
 */
async function dropSeedData() {
  console.log('Sear POS — Reset Script')
  console.log('=======================')
  console.log()
  console.log(`Dropping all data for org_id: ${ORG_ID}`)
  console.log()

  // Order matters: delete child tables first to avoid FK violations.
  // The admin client bypasses RLS.

  const tablesToClean = [
    // Payments & order-related (most dependent)
    'payments',
    'order_item_modifiers',   // FK to order_items
    'order_items',
    'order_modifications',
    'orders',
    // KDS
    'kds_ticket_events',
    'kds_stations',
    // Menu join table (no org_id, cleaned by cascading delete on menu_items)
    // but let's be explicit in case cascades aren't set
    'menu_item_modifier_groups',
    // Modifiers
    'modifiers',
    'modifier_groups',
    // Menu
    'menu_items',
    'menu_categories',
    // Tables & floor plans
    'tables',
    'floor_plans',
    // Tax rates
    'tax_rates',
    // Staff-related
    'time_entries',
    'tip_distributions',
    'tip_pools',
    // Users
    'users',
    // Settings
    'org_modules',
    'terminals',
    // Location & Org (last)
    'locations',
    'organizations',
  ]

  for (const table of tablesToClean) {
    try {
      // For join tables without org_id, we skip (they cascade)
      // Try org_id filter first
      const { error } = await (supabase.from(table))
        .delete()
        .eq('org_id', ORG_ID)

      if (error) {
        // Table might not have org_id column (like menu_item_modifier_groups)
        // or might not exist — that's fine, just skip
        if (error.message.includes('column') || error.code === '42703') {
          // Try without org_id filter — delete by related IDs
          // For organizations table, filter by id directly
          if (table === 'organizations') {
            const { error: orgErr } = await (supabase.from(table))
              .delete()
              .eq('id', ORG_ID)
            if (orgErr) {
              console.log(`  ~ ${table}: skipped (${orgErr.message})`)
            } else {
              console.log(`  - ${table}: cleaned`)
            }
          } else {
            console.log(`  ~ ${table}: skipped (no org_id column)`)
          }
        } else {
          console.log(`  ~ ${table}: skipped (${error.message})`)
        }
      } else {
        console.log(`  - ${table}: cleaned`)
      }
    } catch (err) {
      console.log(`  ~ ${table}: skipped (${(err as Error).message})`)
    }
  }

  console.log()
  console.log('Drop complete.')
}

async function main() {
  await dropSeedData()

  console.log()
  console.log('Re-seeding...')
  console.log()

  // Run the seed script
  try {
    execSync('npx tsx src/scripts/seed.ts', {
      stdio: 'inherit',
      cwd: process.cwd(),
    })
  } catch {
    console.error('Re-seed failed.')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Reset failed:', err)
  process.exit(1)
})

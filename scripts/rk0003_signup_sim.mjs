#!/usr/bin/env node
/**
 * RK-0003 (V8.5 demo) — throwaway-tenant provisioner / verifier / teardown.
 *
 * NOT part of the product. A one-shot harness used to simulate stranger
 * signups (the onboarding wizard → /api/onboarding/commit path) against a
 * LOCAL prod server WITHOUT touching the real demo tenant. It creates N fully
 * ISOLATED orgs (one owner each) so every "stranger" is a distinct tenant, and
 * tears the whole set down afterward.
 *
 * Usage:
 *   node scripts/rk0003_signup_sim.mjs provision [count] [outfile]
 *   node scripts/rk0003_signup_sim.mjs verify   <outfile>
 *   node scripts/rk0003_signup_sim.mjs teardown <outfile>
 *
 * `outfile` holds a JSON array of {orgId, orgSlug, userId, email, password}.
 * Reads SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL from .env.local.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function loadEnv() {
  try {
    const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    /* env may already be present */
  }
}
loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing SUPABASE_URL / SERVICE_ROLE_KEY')
  process.exit(1)
}
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

// A stable marker written into org.settings so teardown can PROVE a target is
// a sim org before it deletes anything. Never confuse this with real data.
const MARKER = 'rk0003-signup-sim'

async function provisionOne(i) {
  const stamp = `${Date.now().toString(36)}${i}`
  const orgSlug = `${MARKER}-${stamp}`
  const email = `${MARKER}+${stamp}@example.com`
  const password = `Sear!${stamp}Rk0003`

  const { data: org, error: orgErr } = await admin
    .from('organizations')
    .insert({ name: `RK0003 Sim Restaurant ${stamp}`, slug: orgSlug, settings: { [MARKER]: true } })
    .select('id')
    .single()
  if (orgErr) throw new Error(`org insert: ${orgErr.message}`)

  let userId
  try {
    const { data: created, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { rk0003: true },
    })
    if (authErr) throw new Error(`auth createUser: ${authErr.message}`)
    userId = created.user.id

    const { error: userErr } = await admin.from('users').insert({
      id: userId,
      org_id: org.id,
      email,
      first_name: 'Sim',
      last_name: 'Owner',
      display_name: 'Sim Owner',
      role: 'owner',
      is_active: true,
      location_ids: [],
    })
    if (userErr) throw new Error(`users insert: ${userErr.message}`)
  } catch (err) {
    // Roll back so a partial failure never orphans a row in the DB.
    if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {})
    await admin.from('users').delete().eq('org_id', org.id).catch(() => {})
    await admin.from('organizations').delete().eq('id', org.id).catch(() => {})
    throw err
  }

  return { orgId: org.id, orgSlug, userId, email, password }
}

async function provision(count, outfile) {
  const n = Number(count) || 5
  const owners = []
  try {
    for (let i = 0; i < n; i++) owners.push(await provisionOne(i))
  } catch (err) {
    // On any mid-run failure, tear down what we already created before exiting.
    for (const o of owners) await destroyOne(o).catch(() => {})
    throw err
  }
  if (outfile) writeFileSync(outfile, JSON.stringify(owners, null, 2))
  console.log(JSON.stringify(owners))
}

function readOwners(outfile) {
  if (!outfile) throw new Error('missing owners file')
  return JSON.parse(readFileSync(outfile, 'utf8'))
}

async function verify(outfile) {
  const owners = readOwners(outfile)
  const tables = ['locations', 'menu_categories', 'menu_items', 'modifier_groups', 'modifiers', 'terminals']
  const report = []
  for (const o of owners) {
    const counts = {}
    for (const t of tables) {
      const { count, error } = await admin.from(t).select('id', { count: 'exact', head: true }).eq('org_id', o.orgId)
      if (error) throw new Error(`${t} count: ${error.message}`)
      counts[t] = count
    }
    const { data: org } = await admin.from('organizations').select('name, owner_email, settings').eq('id', o.orgId).single()
    report.push({ orgId: o.orgId, name: org?.name, counts })
  }
  console.log(JSON.stringify(report, null, 2))
}

/**
 * Delete every row belonging to ONE sim org — but only after PROVING the org
 * carries the sim marker. Refuses to touch an org that isn't ours.
 */
async function destroyOne(o) {
  const { data: org, error } = await admin
    .from('organizations')
    .select('id, settings')
    .eq('id', o.orgId)
    .maybeSingle()
  if (error) throw new Error(`guard lookup: ${error.message}`)
  if (!org) return { orgId: o.orgId, skipped: 'org not found (already gone)' }
  if (!org.settings || org.settings[MARKER] !== true) {
    throw new Error(`REFUSING to delete ${o.orgId}: missing '${MARKER}' marker — not a sim org`)
  }

  // Delete in FK-dependency order (org delete does NOT cascade menu/location/terminals).
  const { data: items } = await admin.from('menu_items').select('id').eq('org_id', o.orgId)
  const itemIds = (items ?? []).map((r) => r.id)
  if (itemIds.length) await admin.from('menu_item_modifier_groups').delete().in('menu_item_id', itemIds)
  await admin.from('modifiers').delete().eq('org_id', o.orgId)
  await admin.from('modifier_groups').delete().eq('org_id', o.orgId)
  await admin.from('menu_items').delete().eq('org_id', o.orgId)
  await admin.from('menu_categories').delete().eq('org_id', o.orgId)
  await admin.from('terminals').delete().eq('org_id', o.orgId)
  await admin.from('setup_progress').delete().eq('org_id', o.orgId)
  await admin.from('locations').delete().eq('org_id', o.orgId)
  await admin.from('users').delete().eq('org_id', o.orgId)
  const { error: orgDelErr } = await admin.from('organizations').delete().eq('id', o.orgId)
  if (orgDelErr) throw new Error(`org delete failed for ${o.orgId} (leak!): ${orgDelErr.message}`)
  // Prove it's actually gone — a silent no-op delete must not read as success.
  const { data: still } = await admin.from('organizations').select('id').eq('id', o.orgId).maybeSingle()
  if (still) throw new Error(`org ${o.orgId} still present after delete (leak!)`)
  if (o.userId) {
    const { error: delErr } = await admin.auth.admin.deleteUser(o.userId)
    if (delErr) console.error(`auth deleteUser warning (${o.userId}): ${delErr.message}`)
  }
  return { orgId: o.orgId, teardown: 'ok' }
}

async function teardown(outfile) {
  const owners = readOwners(outfile)
  const results = []
  for (const o of owners) results.push(await destroyOne(o))
  console.log(JSON.stringify(results, null, 2))
}

const [cmd, a, b] = process.argv.slice(2)
try {
  if (cmd === 'provision') await provision(a, b)
  else if (cmd === 'verify') await verify(a)
  else if (cmd === 'teardown') await teardown(a)
  else {
    console.error('usage: provision [count] [outfile] | verify <outfile> | teardown <outfile>')
    process.exit(1)
  }
} catch (err) {
  console.error('ERROR:', err.message)
  process.exit(1)
}

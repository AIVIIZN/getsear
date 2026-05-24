import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const migrationsDir = path.join(root, 'supabase', 'migrations')
const baselinePath = path.join(migrationsDir, '00000000000000_baseline.sql')
const trust2Path = path.join(migrationsDir, '20260524112546_tighten_permissive_rls_policies.sql')

interface Policy {
  name: string
  table: string
  body: string
}

function readSql(filePath: string) {
  return readFileSync(filePath, 'utf8')
}

function parseQuotedPolicies(sql: string): Policy[] {
  const policies: Policy[] = []
  const policyRegex =
    /CREATE POLICY "([^"]+)" ON "public"\."([^"]+)"([\s\S]*?);/g

  for (const match of sql.matchAll(policyRegex)) {
    policies.push({
      name: match[1],
      table: match[2],
      body: match[3],
    })
  }

  return policies
}

function parsePolicies(sql: string): Policy[] {
  const policies: Policy[] = []
  const policyRegex =
    /CREATE POLICY "?([A-Za-z0-9_]+)"?\s+ON\s+(?:"public"\."([A-Za-z0-9_]+)"|public\.([A-Za-z0-9_]+))([\s\S]*?);/g

  for (const match of sql.matchAll(policyRegex)) {
    policies.push({
      name: match[1],
      table: match[2] ?? match[3],
      body: match[4],
    })
  }

  return policies
}

function migrationDropsPolicy(sql: string, policy: Policy) {
  const escapedPolicy = policy.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escapedTable = policy.table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const dropRegex = new RegExp(
    `DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+"${escapedPolicy}"\\s+ON\\s+public\\.${escapedTable}\\b`,
    'i',
  )

  return dropRegex.test(sql)
}

describe('TRUST-2 RLS policy hardening', () => {
  it('drops every baseline authenticated WITH CHECK (true) tenant policy outside reviewed public/service-role exceptions', () => {
    const baselinePolicies = parseQuotedPolicies(readSql(baselinePath))
    const laterMigrations = readdirSync(migrationsDir)
      .filter((fileName) => /^\d{14}_.+\.sql$/.test(fileName))
      .filter((fileName) => fileName !== '00000000000000_baseline.sql')
      .map((fileName) => readSql(path.join(migrationsDir, fileName)))
      .join('\n')

    const intentionallyPublicPolicies = new Set(['demo_requests.demo_requests_public_insert'])
    const unsafeBaselinePolicies = baselinePolicies.filter((policy) => {
      if (!/\bWITH CHECK \(true\)/i.test(policy.body)) return false
      if (/TO\s+"?service_role"?/i.test(policy.body)) return false
      if (intentionallyPublicPolicies.has(`${policy.table}.${policy.name}`)) return false
      return true
    })

    expect(unsafeBaselinePolicies.map((policy) => `${policy.table}.${policy.name}`)).toEqual([
      'ai_usage.ai_usage_insert',
      'break_entries.allow_insert',
      'campaign_recipients.allow_insert',
      'cash_drawer_events.allow_insert',
      'customer_addresses.allow_insert',
      'gift_card_transactions.allow_insert',
      'menu_item_modifier_groups.allow_insert',
      'online_menu_items.allow_insert',
      'order_discounts.allow_insert',
      'order_item_modifiers.allow_insert',
      'purchase_order_items.allow_insert',
      'user_permission_overrides.allow_insert',
    ])

    const undroppedPolicies = unsafeBaselinePolicies.filter(
      (policy) => !migrationDropsPolicy(laterMigrations, policy),
    )

    expect(undroppedPolicies).toEqual([])
  })

  it('does not reintroduce always-true write checks in the TRUST-2 replacement policies', () => {
    const trust2Sql = readSql(trust2Path)
    const trust2Policies = parsePolicies(trust2Sql)

    expect(trust2Policies).not.toEqual([])
    expect(trust2Policies.filter((policy) => /\bWITH CHECK \(true\)/i.test(policy.body))).toEqual([])
    expect(trust2Policies.filter((policy) => /\bUSING \(true\)/i.test(policy.body))).toEqual([])
    expect(trust2Sql).toContain('DROP POLICY IF EXISTS "allow_insert" ON public.order_item_modifiers')
    expect(trust2Sql).toContain('org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())')
  })
})

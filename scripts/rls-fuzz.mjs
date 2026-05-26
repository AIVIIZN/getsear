#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const migrationDir = path.join(root, 'supabase', 'migrations')
const policyOperations = ['select', 'insert', 'update', 'delete']
const intentionallyPublicTables = new Set([
  'demo_requests',
  'permissions',
  'role_permissions',
  'storage',
])

function normalizeTable(raw) {
  return raw
    .replaceAll('"', '')
    .replace(/^public\./, '')
    .trim()
}

const relationPattern = String.raw`(?:"public"\s*\.\s*"?|public\s*\.\s*)?([A-Za-z0-9_]+)"?`

function readSql() {
  return fs
    .readdirSync(migrationDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => fs.readFileSync(path.join(migrationDir, file), 'utf8'))
    .join('\n')
}

function parseTables(sql) {
  const tables = new Map()
  const tableRe = new RegExp(String.raw`CREATE TABLE IF NOT EXISTS\s+${relationPattern}\s*\(([\s\S]*?)\n\);`, 'g')
  for (const match of sql.matchAll(tableRe)) {
    const table = normalizeTable(match[1])
    const body = match[2]
    const columns = [...body.matchAll(/^\s+"?([A-Za-z0-9_]+)"?\s+/gm)].map((column) => column[1])
    tables.set(table, {
      table,
      hasOrgId: columns.includes('org_id'),
      hasUserId: columns.includes('user_id'),
      hasRls: false,
      policies: new Map(),
    })
  }
  return tables
}

function applyRls(sql, tables) {
  const rlsRe = new RegExp(String.raw`ALTER TABLE\s+${relationPattern}\s+ENABLE ROW LEVEL SECURITY`, 'gi')
  for (const match of sql.matchAll(rlsRe)) {
    const table = normalizeTable(match[1])
    if (!tables.has(table)) {
      tables.set(table, { table, hasOrgId: false, hasUserId: false, hasRls: false, policies: new Map() })
    }
    tables.get(table).hasRls = true
  }
}

function applyPolicies(sql, tables) {
  const dropRe = new RegExp(String.raw`DROP POLICY IF EXISTS\s+"?([^"\n]+)"?\s+ON\s+${relationPattern}`, 'i')
  const createRe = new RegExp(String.raw`CREATE POLICY\s+"?([^"\n]+)"?\s+ON\s+${relationPattern}([\s\S]*)`, 'i')

  for (const rawStatement of sql.split(';')) {
    const statement = rawStatement.trim()
    if (!statement) continue

    const drop = statement.match(dropRe)
    if (drop) {
      const state = tables.get(normalizeTable(drop[2]))
      state?.policies.delete(drop[1].trim())
      continue
    }

    const create = statement.match(createRe)
    if (create) {
      const name = create[1].trim()
      const table = normalizeTable(create[2])
      const definition = create[3].replace(/\s+/g, ' ').trim()
      if (!tables.has(table)) {
        tables.set(table, { table, hasOrgId: false, hasUserId: false, hasRls: false, policies: new Map() })
      }
      tables.get(table).policies.set(name, definition)
    }
  }
}

function policyOperation(name, definition) {
  const explicit = definition.match(/\bFOR\s+(SELECT|INSERT|UPDATE|DELETE)\b/i)?.[1]?.toLowerCase()
  if (explicit) return explicit
  return policyOperations.find((operation) => name.toLowerCase().includes(operation)) ?? 'all'
}

function isTenantScoped(definition) {
  const lower = definition.toLowerCase()
  if (/\bto\s+"?service_role"?\b/.test(lower)) return true
  if (/\bto\s+"?(supabase_auth_admin|postgres)"?\b/.test(lower)) return true
  if (/using\s*\(\s*false\s*\)/.test(lower) || /with check\s*\(\s*false\s*\)/.test(lower)) return true
  if (lower.includes('request.jwt.claims') && lower.includes('org_id')) return true
  if (!/("?auth"?\s*\.\s*"?uid"?\s*\(\)|auth\.uid)/.test(lower)) return false
  return /\borg_id\b/.test(lower) || /\buser_id\b/.test(lower) || /\bexists\s*\(/.test(lower)
}

function isPermissiveAuthenticated(definition) {
  const lower = definition.toLowerCase()
  if (/\bto\s+"?service_role"?\b/.test(lower)) return false
  if (/\bto\s+"?(supabase_auth_admin|postgres)"?\b/.test(lower)) return false
  return /using\s*\(\s*true\s*\)/.test(lower) || /with check\s*\(\s*true\s*\)/.test(lower)
}

export function buildRlsFuzzReport() {
  const sql = readSql()
  const tables = parseTables(sql)
  applyRls(sql, tables)
  applyPolicies(sql, tables)

  const tenantTables = [...tables.values()]
    .filter((table) => !intentionallyPublicTables.has(table.table))
    .filter((table) => table.hasOrgId || table.hasUserId || table.hasRls || table.policies.size > 0)
    .sort((a, b) => a.table.localeCompare(b.table))

  const cases = []
  const findings = []

  for (const table of tenantTables) {
    if (!table.hasRls) {
      findings.push({ severity: 'high', table: table.table, check: 'rls_enabled', problem: 'Tenant table does not enable RLS.' })
    }

    const policies = [...table.policies.entries()].map(([name, definition]) => ({
      name,
      definition,
      operation: policyOperation(name, definition),
      tenantScoped: isTenantScoped(definition),
      permissiveAuthenticated: isPermissiveAuthenticated(definition),
    }))

    for (const policy of policies) {
      if (!policy.tenantScoped) {
        findings.push({ severity: 'high', table: table.table, policy: policy.name, check: 'tenant_scope', problem: 'Policy does not scope to auth.uid tenant/user context.' })
      }
      if (policy.permissiveAuthenticated) {
        findings.push({ severity: 'critical', table: table.table, policy: policy.name, check: 'permissive_true', problem: 'Authenticated policy allows USING/WITH CHECK true.' })
      }
    }

    for (const operation of policyOperations) {
      const operationPolicies = policies.filter((policy) => policy.operation === operation || policy.operation === 'all')
      cases.push({
        id: `${table.table}:${operation}:foreign_org_id`,
        table: table.table,
        operation,
        attack: `malicious tenant attempts ${operation.toUpperCase()} with another org_id`,
        expected: operation === 'select' ? 'empty' : '403',
        pass: table.hasRls && operationPolicies.every((policy) => policy.tenantScoped && !policy.permissiveAuthenticated),
      })
    }
  }

  const failedCases = cases.filter((testCase) => !testCase.pass)
  return {
    generated_at: new Date().toISOString(),
    tables_checked: tenantTables.length,
    cases,
    case_count: cases.length,
    failed_cases: failedCases,
    findings,
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = buildRlsFuzzReport()
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  } else {
    process.stdout.write(`RLS fuzz cases: ${report.case_count} across ${report.tables_checked} tenant tables\n`)
    process.stdout.write(`Failed cases: ${report.failed_cases.length}\n`)
    for (const finding of report.findings) {
      process.stdout.write(`${finding.severity.toUpperCase()} ${finding.table}${finding.policy ? `.${finding.policy}` : ''}: ${finding.problem}\n`)
    }
  }

  if (report.case_count < 100 || report.failed_cases.length > 0 || report.findings.some((finding) => finding.severity === 'critical')) {
    process.exitCode = 1
  }
}

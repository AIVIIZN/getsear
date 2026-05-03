#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { exit } from 'node:process'

const projectRef = process.env.SUPABASE_PROJECT_REF || 'lbekiyxqemxozmghgmtp'

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' })
  return { code: r.status ?? 1, stdout: r.stdout || '', stderr: r.stderr || '' }
}

const linked = run('supabase', ['link', '--project-ref', projectRef])
if (linked.code !== 0 && !linked.stderr.includes('already linked')) {
  console.error('[db:diff] supabase link failed:', linked.stderr)
  exit(2)
}

const diff = run('supabase', ['db', 'diff', '--linked', '--schema', 'public'])
if (diff.code !== 0) {
  console.error('[db:diff] supabase db diff exited non-zero:', diff.stderr)
  exit(2)
}

const sql = diff.stdout
  .split('\n')
  .filter((l) => !/^A new version of Supabase CLI/.test(l))
  .filter((l) => !/^We recommend updating/.test(l))
  .join('\n')
  .trim()

if (sql.length === 0) {
  console.log('[db:diff] no schema drift between linked DB and committed migrations')
  exit(0)
}

console.error('[db:diff] schema drift detected:\n')
console.error(sql)
console.error('\n[db:diff] commit a migration covering this drift before merging.')
exit(1)

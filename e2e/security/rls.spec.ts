import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'

type RlsCase = {
  id: string
  table: string
  operation: 'select' | 'insert' | 'update' | 'delete'
  attack: string
  expected: '403' | 'empty'
  pass: boolean
}

type RlsReport = {
  case_count: number
  tables_checked: number
  cases: RlsCase[]
  failed_cases: RlsCase[]
  findings: Array<{ severity: string; table: string; policy?: string; problem: string }>
}

function runRlsFuzz(): RlsReport {
  const output = execFileSync('node', ['scripts/rls-fuzz.mjs', '--json'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return JSON.parse(output) as RlsReport
}

test.describe('V8.3.1 RLS malicious tenant fuzz suite', () => {
  test('generates 100+ cross-tenant access attempts and finds no leakage vectors', () => {
    const report = runRlsFuzz()

    expect(report.case_count).toBeGreaterThanOrEqual(100)
    expect(report.tables_checked).toBeGreaterThanOrEqual(25)
    expect(report.failed_cases).toEqual([])
    expect(report.findings.filter((finding) => finding.severity === 'critical')).toEqual([])
  })

  test('every generated malicious tenant case denies writes or returns empty reads', () => {
    const report = runRlsFuzz()

    for (const testCase of report.cases) {
      expect(testCase.attack).toContain('another org_id')
      expect(['403', 'empty']).toContain(testCase.expected)
      expect(testCase.pass, testCase.id).toBe(true)
    }
  })
})

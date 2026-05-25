import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  filterNewViolations,
  findRawHexOccurrences,
  loadBaseline,
  scanRepository,
} from '../../scripts/raw-hex-guard.mjs'

describe('raw hex guard', () => {
  it('fails a raw hex in a covered component file', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'sear-raw-hex-fail-'))
    await mkdir(path.join(root, 'src/components'), { recursive: true })
    await writeFile(
      path.join(root, 'src/components/Button.tsx'),
      "export function Button() { return <button className=\"bg-[#123456]\" /> }\n",
    )

    const result = scanRepository({ root })

    expect(result.violations).toHaveLength(1)
    expect(result.violations[0]).toMatchObject({
      file: 'src/components/Button.tsx',
      hex: '#123456',
    })
  })

  it('passes semantic CSS variables in a covered component file', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'sear-raw-hex-pass-'))
    await mkdir(path.join(root, 'src/components'), { recursive: true })
    await writeFile(
      path.join(root, 'src/components/Button.tsx'),
      "export function Button() { return <button style={{ color: 'var(--color-primary)' }} /> }\n",
    )

    const result = scanRepository({ root })

    expect(result.violations).toEqual([])
  })

  it('allows primitive token definitions only in the token source file', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'sear-raw-hex-token-'))
    await mkdir(path.join(root, 'src/styles'), { recursive: true })
    await writeFile(path.join(root, 'src/styles/tokens.css'), ':root { --color-blue-600: #2563EB; }\n')

    const result = scanRepository({
      root,
      coveredDirs: ['src/styles'],
      extensions: new Set(['.css']),
    })

    expect(result.violations).toEqual([])
  })

  it('keeps legacy baseline entries from failing while rejecting new raw hex', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'sear-raw-hex-baseline-'))
    await mkdir(path.join(root, 'src/components'), { recursive: true })
    await mkdir(path.join(root, 'scripts'), { recursive: true })
    await writeFile(
      path.join(root, 'src/components/Card.tsx'),
      [
        "export const legacy = 'text-[#111111]'",
        "export const regression = 'text-[#222222]'",
        '',
      ].join('\n'),
    )
    await writeFile(
      path.join(root, 'scripts/raw-hex-baseline.json'),
      JSON.stringify({
        violations: [
          {
            file: 'src/components/Card.tsx',
            hex: '#111111',
            lineText: "export const legacy = 'text-[#111111]'",
          },
        ],
      }),
    )

    const result = scanRepository({
      root,
      baselinePath: path.join(root, 'scripts/raw-hex-baseline.json'),
    })
    const baseline = loadBaseline(path.join(root, 'scripts/raw-hex-baseline.json'))

    expect(filterNewViolations(result.occurrences, baseline)).toEqual(result.violations)
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].hex).toBe('#222222')
  })

  it('keeps the component spec examples scanner-safe', async () => {
    const source = await readFile(
      path.join(process.cwd(), 'docs/design/UI_V2_COMPONENT_SPEC.md'),
      'utf8',
    )

    const result = findRawHexOccurrences(source, 'docs/design/UI_V2_COMPONENT_SPEC.md')

    expect(source).toContain('Scanner-Safe Example Pattern')
    expect(result).toEqual([])
  })
})

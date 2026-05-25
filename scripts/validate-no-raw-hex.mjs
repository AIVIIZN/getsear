#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { scanRepository } from './raw-hex-guard.mjs'

const root = process.cwd()
const defaultBaselinePath = path.join(root, 'scripts/raw-hex-baseline.json')
const args = new Set(process.argv.slice(2))
const baselinePath = getArgValue('--baseline') ?? defaultBaselinePath
const result = scanRepository({ root, baselinePath })

if (args.has('--update-baseline')) {
  const payload = {
    note: 'Temporary legacy raw-hex baseline for DESIGN-TOKENS-V1. Do not add entries; later token sweep tasks remove this file after violations reach zero.',
    allowedException: 'Primitive raw color values are allowed only in src/styles/tokens.css.',
    generatedBy: 'scripts/validate-no-raw-hex.mjs --update-baseline',
    coveredPaths: ['src/components/**', 'src/app/**'],
    pattern: '#[0-9a-fA-F]{3,8}\\b',
    violationCount: result.occurrences.length,
    violations: result.occurrences.map((occurrence) => ({
      file: occurrence.file,
      hex: occurrence.hex,
      lineText: occurrence.lineText.trim(),
    })),
  }
  mkdirSync(path.dirname(baselinePath), { recursive: true })
  writeFileSync(baselinePath, `${JSON.stringify(payload, null, 2)}\n`)
  console.log(`Recorded ${payload.violationCount} legacy raw-hex occurrences in ${path.relative(root, baselinePath)}.`)
  process.exit(0)
}

if (result.violations.length > 0) {
  console.error('Raw hex colors are not allowed in src/components/** or src/app/**.')
  console.error('Use a semantic token from src/styles/tokens.css or add one there before using this color.')
  console.error('Primitive token definitions are allowed only in src/styles/tokens.css.')
  console.error('')

  for (const violation of result.violations.slice(0, 50)) {
    console.error(
      `${violation.file}:${violation.line}:${violation.column} ${violation.hex} -> ${violation.lineText.trim()}`,
    )
  }

  if (result.violations.length > 50) {
    console.error(`...and ${result.violations.length - 50} more raw-hex violations.`)
  }

  process.exit(1)
}

console.log(`Raw hex guard passed (${result.occurrences.length} legacy baseline occurrences, 0 new violations).`)

function getArgValue(name) {
  const prefix = `${name}=`
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix))
  if (!match) {
    return null
  }

  const value = match.slice(prefix.length)
  if (path.isAbsolute(value)) {
    return value
  }

  return path.join(path.dirname(fileURLToPath(import.meta.url)), '..', value)
}

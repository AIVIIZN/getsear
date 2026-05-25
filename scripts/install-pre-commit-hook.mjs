#!/usr/bin/env node
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const root = process.cwd()
const hooksDir = execFileSync('git', ['rev-parse', '--git-path', 'hooks'], {
  cwd: root,
  encoding: 'utf8',
}).trim()
const hookPath = path.join(hooksDir, 'pre-commit')

if (!existsSync(path.join(root, '.git'))) {
  process.exit(0)
}

mkdirSync(hooksDir, { recursive: true })

writeFileSync(
  hookPath,
  `#!/bin/sh
set -eu

npm run lint:raw-hex
`,
)
chmodSync(hookPath, 0o755)

console.log('Installed raw-hex pre-commit hook.')

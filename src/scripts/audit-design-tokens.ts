#!/usr/bin/env npx tsx
/**
 * Design Token Audit Script
 *
 * Scans all .tsx files in src/ for violations of the Sear POS design system:
 * - Hardcoded hex colors (#3b82f6, #ffffff, etc.)
 * - Tailwind default color classes (bg-blue-500, text-gray-400, etc.)
 * - Spacing values not on the 4px grid
 * - Missing aria-label on icon-only buttons
 *
 * Usage: npx tsx src/scripts/audit-design-tokens.ts
 *
 * Output: violations grouped by file with line numbers and suggested fixes.
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

interface Violation {
  file: string
  line: number
  type: 'color' | 'tailwind-color' | 'spacing' | 'aria'
  match: string
  suggestion: string
}

const VIOLATIONS: Violation[] = []

// Allowed hex colors (design tokens and their values)
const ALLOWED_HEX = new Set([
  '#F06B18', '#f06b18', // primary
  '#FDFBF7', '#fdfbf7', // background
  '#F2F2F7', '#f2f2f7', // sidebar / iOS background
  '#FFFFFF', '#ffffff', // primary-foreground, card bg
  '#1C1C1E', '#1c1c1e', // foreground
  '#1A1A17', '#1a1a17', // card-foreground
  '#F5F3F0', '#f5f3f0', // secondary
  '#3D3D37', '#3d3d37', // secondary-foreground
  '#F0EDE8', '#f0ede8', // muted
  '#FFF4EC', '#fff4ec', // accent
  '#FF3B30', '#ff3b30', // destructive/error
  '#34C759', '#34c759', // success
  '#FF9500', '#ff9500', // warning
  '#007AFF', '#007aff', // info
  '#000000', '#000000', // KDS dark bg
  '#E05A0A', '#e05a0a', // primary-hover
  '#CC4F08', '#cc4f08', // primary-active
  '#FF9F0A', '#ff9f0a', // KDS dark primary
  '#5856D6', '#5856d6', // reserved/online
  '#AF52DE', '#af52de', // ordered/delivery
  '#5AC8FA', '#5ac8fa', // served/catering
  '#FF2D55', '#ff2d55', // drive-thru
  '#8E8E93', '#8e8e93', // dirty/sidebar-muted
  '#FF453A', '#ff453a', // KDS destructive
  '#CD7F32', '#cd7f32', // Bronze
  '#C0C0C0', '#c0c0c0', // Silver
  '#FFD700', '#ffd700', // Gold
  '#E5E4E2', '#e5e4e2', // Platinum
  '#7C3AED', '#7c3aed', // Purple (ordered status)
  '#F3EEFF', '#f3eeff', // Purple bg
  '#EEF0FF', '#eef0ff', // Reserved bg
])

// Tailwind default color classes that should use design tokens
const TAILWIND_COLOR_RE =
  /\b(bg|text|border|ring|from|to|via|outline|fill|stroke|divide|placeholder)-(red|blue|green|yellow|gray|slate|zinc|neutral|stone|orange|amber|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose|lime|warm)-\d{2,3}\b/g

// Hardcoded hex in className or style
const HEX_COLOR_RE = /#[0-9a-fA-F]{3,8}\b/g

// Spacing not on 4px grid (arbitrary values)
const BAD_SPACING_RE = /\b[pm][trblxy]?-\[(\d+)px\]/g

// Icon-only button without aria-label
const ICON_BUTTON_RE = /<Button[^>]*size=["']icon[^>]*>/g

const SRC_DIR = join(process.cwd(), 'src')

function walkDir(dir: string): string[] {
  const results: string[] = []
  try {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      const full = join(dir, entry)
      const stat = statSync(full)
      if (stat.isDirectory()) {
        // Skip node_modules and .next
        if (entry === 'node_modules' || entry === '.next') continue
        results.push(...walkDir(full))
      } else if (entry.endsWith('.tsx')) {
        results.push(full)
      }
    }
  } catch {
    // Ignore permission errors
  }
  return results
}

function auditFile(filePath: string) {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const relPath = relative(process.cwd(), filePath)

  lines.forEach((line, idx) => {
    const lineNum = idx + 1

    // Skip comments and imports
    if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('import ')) {
      return
    }

    // Check Tailwind default colors
    let match: RegExpExecArray | null
    TAILWIND_COLOR_RE.lastIndex = 0
    while ((match = TAILWIND_COLOR_RE.exec(line)) !== null) {
      const colorClass = match[0]
      const prefix = match[1]
      VIOLATIONS.push({
        file: relPath,
        line: lineNum,
        type: 'tailwind-color',
        match: colorClass,
        suggestion: `Replace with design token: ${prefix}-[var(--success/warning/error/info/primary/muted)]`,
      })
    }

    // Check hardcoded hex colors (only in className or style props)
    if (line.includes('className') || line.includes('style') || line.includes('color')) {
      HEX_COLOR_RE.lastIndex = 0
      while ((match = HEX_COLOR_RE.exec(line)) !== null) {
        const hex = match[0]
        if (!ALLOWED_HEX.has(hex) && hex.length >= 7) {
          VIOLATIONS.push({
            file: relPath,
            line: lineNum,
            type: 'color',
            match: hex,
            suggestion: 'Replace with CSS custom property: var(--token-name)',
          })
        }
      }
    }

    // Check bad spacing
    BAD_SPACING_RE.lastIndex = 0
    while ((match = BAD_SPACING_RE.exec(line)) !== null) {
      const px = parseInt(match[1], 10)
      if (px % 4 !== 0) {
        VIOLATIONS.push({
          file: relPath,
          line: lineNum,
          type: 'spacing',
          match: match[0],
          suggestion: `${px}px is not on the 4px grid. Use ${Math.round(px / 4) * 4}px instead.`,
        })
      }
    }

    // Check icon-only buttons without aria-label
    ICON_BUTTON_RE.lastIndex = 0
    while ((match = ICON_BUTTON_RE.exec(line)) !== null) {
      if (!match[0].includes('aria-label')) {
        VIOLATIONS.push({
          file: relPath,
          line: lineNum,
          type: 'aria',
          match: match[0].slice(0, 60) + '...',
          suggestion: 'Add aria-label to icon-only button for accessibility',
        })
      }
    }
  })
}

// Run audit
console.log('Sear POS Design Token Audit')
console.log('===========================\n')

const files = walkDir(SRC_DIR)
console.log(`Scanning ${files.length} .tsx files...\n`)

for (const file of files) {
  auditFile(file)
}

// Group by file
const grouped = new Map<string, Violation[]>()
for (const v of VIOLATIONS) {
  const existing = grouped.get(v.file) ?? []
  existing.push(v)
  grouped.set(v.file, existing)
}

// Output
if (VIOLATIONS.length === 0) {
  console.log('No violations found! Design system is fully enforced.')
} else {
  const byType = {
    color: VIOLATIONS.filter((v) => v.type === 'color').length,
    'tailwind-color': VIOLATIONS.filter((v) => v.type === 'tailwind-color').length,
    spacing: VIOLATIONS.filter((v) => v.type === 'spacing').length,
    aria: VIOLATIONS.filter((v) => v.type === 'aria').length,
  }

  console.log('SUMMARY')
  console.log(`  Hardcoded colors:       ${byType.color}`)
  console.log(`  Tailwind default colors: ${byType['tailwind-color']}`)
  console.log(`  Bad spacing (not 4px):  ${byType.spacing}`)
  console.log(`  Missing aria-label:     ${byType.aria}`)
  console.log(`  TOTAL:                  ${VIOLATIONS.length}`)
  console.log()

  for (const [file, violations] of grouped) {
    console.log(`\n--- ${file} (${violations.length} violations) ---`)
    for (const v of violations) {
      console.log(`  L${v.line} [${v.type}] ${v.match}`)
      console.log(`    -> ${v.suggestion}`)
    }
  }
}

process.exit(VIOLATIONS.length > 0 ? 1 : 0)

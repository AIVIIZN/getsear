import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * RK-0006 — guard tests for the competing-redesign theme layer.
 *
 * The three directions must be strictly ADDITIVE and FLAG-OFF: with no
 * `data-theme` attribute on <html>, the app must render exactly as before.
 * These tests fail if a future edit leaks an override into a bare `:root`/
 * element rule (which would change the baseline) or drops a direction.
 */
const css = readFileSync(
  join(process.cwd(), 'src/styles/themes.css'),
  'utf8',
)

// Strip block comments so selectors inside prose don't count.
const code = css.replace(/\/\*[\s\S]*?\*\//g, '')

describe('themes.css flag-off invariant', () => {
  it('defines all three directions', () => {
    for (const theme of ['refined', 'ipados', 'operational']) {
      expect(code).toContain(`[data-theme="${theme}"]`)
    }
  })

  it('scopes every rule under [data-theme] (no baseline mutation)', () => {
    // Every selector list that opens a block must contain a data-theme scope.
    const selectors = code
      .split('}')
      .map((chunk) => chunk.split('{')[0])
      .filter((sel) => sel && sel.includes('{') === false)
      .map((sel) => sel.trim())
      .filter(Boolean)

    for (const sel of selectors) {
      expect(
        sel.includes('[data-theme='),
        `selector "${sel}" is not scoped to a data-theme — would mutate baseline`,
      ).toBe(true)
    }
  })

  it('uses :root[data-theme] specificity on the direction root blocks', () => {
    for (const theme of ['refined', 'ipados', 'operational']) {
      expect(code).toContain(`:root[data-theme="${theme}"]`)
    }
  })

  it('confines the only !important to the operational sidebar', () => {
    const importantLines = code
      .split('\n')
      .filter((l) => l.includes('!important'))
    expect(importantLines.length).toBe(1)
    expect(importantLines[0]).toContain('background')
  })
})

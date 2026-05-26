import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { apiError, forbidden, rateLimited, validationError } from '@/lib/api/error-response'

function collectRouteFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry)
    if (statSync(fullPath).isDirectory()) return collectRouteFiles(fullPath)
    return entry === 'route.ts' ? [fullPath] : []
  })
}

describe('V8.2 API error contract', () => {
  it('returns code, message, and action with every shared API error response', async () => {
    const cases = [
      apiError(500, 'failed to fetch order'),
      forbidden(),
      validationError({ name: ['Required'] }),
      rateLimited(30),
    ]

    for (const response of cases) {
      const body = await response.json()
      expect(body.error).toBeTypeOf('string')
      expect(body.code).toBeTypeOf('string')
      expect(body.message).toBeTypeOf('string')
      expect(body.action).toBeTypeOf('string')
      expect(body.message).toMatch(/[.!?]$/)
      expect(body.action).toMatch(/[.!?]$/)
    }
  })

  it('does not leave raw top-level API route error responses behind', () => {
    const files = collectRouteFiles(path.join(process.cwd(), 'src/app/api'))
    const offenders = files.filter((file) => {
      const source = readFileSync(file, 'utf8')
      return source.replace(/\s+/g, '').includes('NextResponse.json({error:')
    })

    expect(offenders).toEqual([])
  })
})

'use client'

import { useEffect } from 'react'

/**
 * Wires the double-submit CSRF token into the client fetch layer, once,
 * centrally.
 *
 * The server sets a non-httpOnly `sear_csrf` cookie (see middleware). This
 * component patches `window.fetch` so every same-origin mutating `/api/`
 * request automatically echoes that cookie back in the `x-csrf-token` header.
 * That makes the double-submit token an active defence (previously no client
 * sent it) — belt-and-suspenders alongside the Origin same-origin check.
 *
 * It is deliberately conservative:
 *   - only touches same-origin `/api/` requests with an unsafe method,
 *   - never overwrites a header the caller already set,
 *   - never touches cross-origin requests (e.g. Supabase, Twilio),
 *   - fully wrapped in try/catch so it can never break a fetch.
 */

const CSRF_COOKIE = 'sear_csrf'
const CSRF_HEADER = 'x-csrf-token'
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function readCsrfCookie(): string | null {
  const match = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${CSRF_COOKIE}=`))
  if (!match) return null
  const value = match.slice(CSRF_COOKIE.length + 1)
  return value ? decodeURIComponent(value) : null
}

function installCsrfFetch(): void {
  const w = window as typeof window & { __searCsrfPatched?: boolean }
  if (w.__searCsrfPatched) return
  w.__searCsrfPatched = true

  const originalFetch = window.fetch.bind(window)

  window.fetch = function patchedFetch(input, init) {
    try {
      const request = new Request(input as RequestInfo, init)
      const method = request.method.toUpperCase()
      const url = new URL(request.url, window.location.href)

      const isSameOrigin = url.origin === window.location.origin
      const isApi = url.pathname.startsWith('/api/')
      const isMutating = UNSAFE_METHODS.has(method)
      const alreadySet = request.headers.has(CSRF_HEADER)

      if (isSameOrigin && isApi && isMutating && !alreadySet) {
        const token = readCsrfCookie()
        if (token) {
          const headers = new Headers(init?.headers)
          // Preserve any headers already on a Request/Headers `input`.
          if (input instanceof Request) {
            input.headers.forEach((v, k) => {
              if (!headers.has(k)) headers.set(k, v)
            })
          }
          headers.set(CSRF_HEADER, token)
          return originalFetch(input, { ...init, headers })
        }
      }
    } catch {
      // fall through to the untouched fetch
    }
    return originalFetch(input as RequestInfo, init)
  }
}

export function CsrfInit() {
  useEffect(() => {
    installCsrfFetch()
  }, [])
  return null
}

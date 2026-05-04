/**
 * Structured logging primitive (V7.1.2).
 *
 * Emits one-line JSON to stdout (info/debug) or stderr (warn/error). Designed
 * to be platform-agnostic — pm2/journald captures the streams in prod, and a
 * downstream shipper (Better Stack / Logflare / Vector) can parse the JSON.
 *
 * No external dependencies (no pino, no winston). If we need pino's perf
 * profile later, swap the `emit` body — the public API (`log.*`,
 * `boundLogger`, `makeReqId`) stays stable.
 *
 * Conventions:
 *   - `req_id` is the correlation ID assigned by `src/middleware.ts` and read
 *     back from the `x-request-id` header in API routes via `getReqLogger`.
 *   - Never log request bodies (PII). Only metadata: route, method, status,
 *     duration_ms, user_id, org_id (when known).
 *   - Errors should pass `err: error.message` and optionally `err_stack`.
 */

export interface LogFields {
  req_id?: string
  user_id?: string
  org_id?: string
  route?: string
  method?: string
  status?: number
  duration_ms?: number
  err?: string
  err_stack?: string
  [k: string]: unknown
}

type Level = 'debug' | 'info' | 'warn' | 'error'

function emit(level: Level, msg: string, fields: LogFields = {}): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...fields,
  })
  // stdout for info/debug, stderr for warn/error to keep streams separate
  // (most log shippers split on this; pm2 already routes them to separate
  // files via `pm2-logrotate`).
  if (level === 'warn' || level === 'error') {
    console.error(line)
  } else {
    console.log(line)
  }
}

export const log = {
  debug: (msg: string, fields?: LogFields) => emit('debug', msg, fields),
  info: (msg: string, fields?: LogFields) => emit('info', msg, fields),
  warn: (msg: string, fields?: LogFields) => emit('warn', msg, fields),
  error: (msg: string, fields?: LogFields) => emit('error', msg, fields),
}

/**
 * Per-request bound logger. Convenience wrapper that pre-fills shared fields
 * (typically `req_id`, `user_id`, `org_id`, `route`) so route handlers can
 * call `rlog.info('payment captured', { status: 200 })` without re-passing
 * the request context on every line.
 */
export interface BoundLogger {
  debug: (msg: string, extra?: LogFields) => void
  info: (msg: string, extra?: LogFields) => void
  warn: (msg: string, extra?: LogFields) => void
  error: (msg: string, extra?: LogFields) => void
}

export function boundLogger(base: LogFields): BoundLogger {
  return {
    debug: (msg, extra) => log.debug(msg, { ...base, ...extra }),
    info: (msg, extra) => log.info(msg, { ...base, ...extra }),
    warn: (msg, extra) => log.warn(msg, { ...base, ...extra }),
    error: (msg, extra) => log.error(msg, { ...base, ...extra }),
  }
}

/**
 * 16-char base36 request ID. Not cryptographically random; fine for log
 * correlation. Combines a random prefix with a time suffix so IDs sort
 * roughly by time when grepping logs and don't collide across requests
 * within the same millisecond.
 */
export function makeReqId(): string {
  const a = Math.random().toString(36).slice(2, 10)
  const b = Date.now().toString(36)
  return (a + b).slice(0, 16)
}

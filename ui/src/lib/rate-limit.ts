/**
 * In-memory per-IP rate limiter for transaction-producing demo routes.
 *
 * The verifier demo and x402 demo routes sign transactions with a
 * server-side wallet. Rate limiting prevents a single caller from
 * draining the wallet or spamming the network.
 *
 * The limit resets when the server process restarts, which is
 * acceptable for a demo. A production deployment should use a
 * persistent store.
 */

const WINDOW_MS = 60_000
const MAX_REQUESTS = 5

const buckets = new Map<string, { count: number; resetAt: number }>()

export type RateLimitResult = { ok: true } | { ok: false; retryAfter: number }

export function checkRateLimit(ip: string): RateLimitResult {
  const now = Date.now()
  const entry = buckets.get(ip)
  if (!entry || entry.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return { ok: true }
  }
  entry.count += 1
  if (entry.count > MAX_REQUESTS) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }
  return { ok: true }
}

export function getClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')
  if (xff) {
    return xff.split(',')[0].trim()
  }
  return 'unknown'
}

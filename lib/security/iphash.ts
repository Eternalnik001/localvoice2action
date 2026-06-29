// ============================================================
// IP hashing for anonymous confirmation dedup (project code rule #8).
// We NEVER store a raw IP. Votes are deduped by a salted SHA-256 hash so one
// device/IP can confirm an issue at most once per 24h, without the platform
// holding identifying data.
// ============================================================

import { createHash } from "node:crypto"

/**
 * Server-side salt. Set CONFIRMATION_IP_SALT in the environment for real
 * deployments; the fallback keeps the demo working without extra config.
 * The salt only ever lives server-side — it is never sent to the client.
 */
function getSalt(): string {
  return process.env.CONFIRMATION_IP_SALT || "lv2a-dev-salt"
}

/** SHA-256(salt + ip), hex. Deterministic per (salt, ip); never reversible to the raw IP. */
export function hashIp(ip: string): string {
  return createHash("sha256")
    .update(`${getSalt()}:${ip}`)
    .digest("hex")
}

/**
 * Best-effort client IP from a Next.js route handler request.
 *
 * Cloud Run sits behind a Google front-end proxy that sets `x-forwarded-for`
 * as `<client-ip>, <proxy-ip>, ...` — so the ORIGINAL client IP is the FIRST
 * entry. Read order (per Cloud Run deployment):
 *   1. x-forwarded-for → first comma-separated value, trimmed
 *   2. x-real-ip (some proxies set this instead)
 *   3. "unknown" (local dev / no proxy headers — still dedups predictably)
 *
 * The IP is only ever passed straight into hashIp(); the raw value is never
 * stored or logged (code rule #8).
 */
export function clientIpFrom(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }
  return headers.get("x-real-ip")?.trim() || "unknown"
}

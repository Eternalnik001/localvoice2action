// ============================================================
// GET /api/my-badges — return the badges the caller's IP earned, claimed via
// their citizenToken. Reads the caller's CURRENT IP-hash, finds the linked
// token, and returns that IP's derived badges + nickname.
//
// Badge link is session-durable but not permanent — IP change or server
// restart resets it. Acceptable for demo scope. On no link found, returns
// { badges: [], reason: "session_expired" } so the client re-shows the
// "save a nickname" prompt gracefully (not an error).
// ============================================================

import { NextResponse } from "next/server"
import { hashIp, clientIpFrom } from "@/lib/security/iphash"
import { tokenForIp, nicknameForToken } from "@/lib/data/citizens"
import { getStore } from "@/lib/data"
import { deriveBadgesForToken } from "@/lib/badges"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const ipHash = hashIp(clientIpFrom(request.headers))
    const token = tokenForIp(ipHash)

    if (!token) {
      // Server restarted or the caller's IP changed — link is gone.
      return NextResponse.json(
        { badges: [], reason: "session_expired" },
        { status: 200 }
      )
    }

    // Badges are derived from the issues this IP-hash reported.
    const issues = await getStore().listIssues()
    const badges = deriveBadgesForToken(ipHash, issues)
    const nickname = nicknameForToken(token)

    return NextResponse.json({ badges, nickname }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

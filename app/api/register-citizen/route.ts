// ============================================================
// POST /api/register-citizen — Tier 2 soft identity (optional, no account).
// Body: { token, nickname }. Links the client's localStorage citizenToken +
// nickname to the caller's anonymous IP-hash, so they can see the badges that
// IP earned. In-memory only — nothing leaves the server, no paid service.
// ============================================================

import { NextResponse } from "next/server"
import { hashIp, clientIpFrom } from "@/lib/security/iphash"
import { registerCitizenToken } from "@/lib/data/citizens"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: unknown
      nickname?: unknown
    }
    if (typeof body.token !== "string" || !body.token) {
      return NextResponse.json({ error: "token is required." }, { status: 400 })
    }
    const nickname =
      typeof body.nickname === "string" && body.nickname.trim()
        ? body.nickname.trim()
        : "Neighbour"

    const ipHash = hashIp(clientIpFrom(request.headers))
    registerCitizenToken(body.token, ipHash, nickname)

    return NextResponse.json({ ok: true, nickname }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

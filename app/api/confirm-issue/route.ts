// ============================================================
// POST /api/confirm-issue — anonymous, frictionless community voting.
// No auth by design. The voter's IP is read server-side and immediately
// hashed (salted SHA-256) into an anonymous token — we NEVER store the raw IP
// (project code rule #8). One vote per token per issue per 24h. Recording a
// vote also recomputes the issue's heatmap_weight (code rule #7, inside the
// data layer).
//
// Wire contract uses lowercase 'still_there'|'fixed_now'; the internal enum is
// uppercase ConfirmationVote — mapped at this boundary.
// ============================================================

import { NextResponse } from "next/server"
import { getStore, CONFIRMATION_WINDOW_MS } from "@/lib/data"
import { hashIp, clientIpFrom } from "@/lib/security/iphash"
import type { ConfirmationVote } from "@/lib/types"

export const runtime = "nodejs"

type WireVote = "still_there" | "fixed_now"

const VOTE_MAP: Record<WireVote, ConfirmationVote> = {
  still_there: "STILL_THERE",
  fixed_now: "FIXED_NOW",
}

function isWireVote(value: unknown): value is WireVote {
  return value === "still_there" || value === "fixed_now"
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown
    const { issueId, vote } =
      typeof body === "object" && body !== null
        ? (body as { issueId?: unknown; vote?: unknown })
        : { issueId: undefined, vote: undefined }

    if (typeof issueId !== "string" || !issueId) {
      return NextResponse.json({ error: "issueId is required." }, { status: 400 })
    }
    if (!isWireVote(vote)) {
      return NextResponse.json(
        { error: "vote must be 'still_there' or 'fixed_now'." },
        { status: 400 }
      )
    }

    const store = getStore()

    // 404 if the issue doesn't exist.
    const issue = await store.getIssue(issueId)
    if (!issue) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 })
    }

    // Read IP server-side, hash immediately into an anonymous voter token.
    const voterToken = hashIp(clientIpFrom(request.headers))

    // Already weighed in within the 24h window? Frictionless, friendly no-op.
    const already = await store.hasRecentConfirmation(
      issueId,
      voterToken,
      CONFIRMATION_WINDOW_MS
    )
    if (already) {
      return NextResponse.json(
        {
          alreadyVoted: true,
          message: "You've already weighed in on this one.",
        },
        { status: 200 }
      )
    }

    // Record the vote (recomputes heatmap_weight internally).
    const result = await store.recordConfirmation(
      issueId,
      VOTE_MAP[vote],
      voterToken
    )
    const updated = result.issue ?? issue
    const counts = updated.confirmations ?? {
      still_there: updated.upvotes,
      fixed_now: 0,
      last_updated: null,
    }

    return NextResponse.json(
      {
        success: true,
        newCounts: {
          stillThere: counts.still_there,
          fixedNow: counts.fixed_now,
        },
      },
      { status: 200 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

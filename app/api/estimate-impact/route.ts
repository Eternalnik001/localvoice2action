// ============================================================
// POST /api/estimate-impact — standalone Agent 6 (Impact Estimator).
// Lets the issue detail page (or a test harness) fetch a live "people
// affected" estimate without going through the full report pipeline.
// Server-only. Never throws — the agent returns a warm fallback on failure.
// ============================================================

import { NextResponse } from "next/server"
import { estimateImpact } from "@/lib/agents/impactEstimator"
import type { IssueType } from "@/lib/types"

export const runtime = "nodejs"

const VALID_SEVERITY = new Set(["low", "medium", "high", "critical"])

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const issueType = body.issueType
    const severity = body.severity
    const area = typeof body.area === "string" ? body.area : "Bengaluru"
    const description =
      typeof body.description === "string" ? body.description : ""

    if (typeof issueType !== "string") {
      return NextResponse.json(
        { error: "issueType is required." },
        { status: 400 }
      )
    }
    if (typeof severity !== "string" || !VALID_SEVERITY.has(severity)) {
      return NextResponse.json(
        { error: "severity must be low|medium|high|critical." },
        { status: 400 }
      )
    }

    const impact = await estimateImpact({
      issueType: issueType as IssueType,
      severity: severity as "low" | "medium" | "high" | "critical",
      area,
      description,
    })

    return NextResponse.json({ impact }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ============================================================
// POST /api/update-issue — lets a citizen correct the AI's issue-type
// classification. Re-runs Agent 3 (routing) for the new type so the authority +
// drafted complaint stay consistent, then persists via the data-access layer.
// ============================================================

import { NextResponse } from "next/server"
import { routeIssue } from "@/lib/agents/routingAgent"
import { getStore } from "@/lib/data"
import type { IssueType } from "@/lib/types"

export const runtime = "nodejs"

const VALID_TYPES: ReadonlyArray<IssueType> = [
  "POTHOLE",
  "WATER_LEAKAGE",
  "BROKEN_STREETLIGHT",
  "GARBAGE_OVERFLOW",
  "DAMAGED_FOOTPATH",
  "ENCROACHMENT",
  "OTHER",
  "NOT_A_CIVIC_ISSUE",
]

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string
      issue_type?: string
    }
    const id = body.id
    const issueType = body.issue_type as IssueType | undefined

    if (!id || !issueType || !VALID_TYPES.includes(issueType)) {
      return NextResponse.json(
        { error: "id and a valid issue_type are required." },
        { status: 400 }
      )
    }

    const store = getStore()
    const issue = await store.getIssue(id)
    if (!issue) {
      return NextResponse.json({ error: "Issue not found." }, { status: 404 })
    }
    if (issue.issue_type === issueType) {
      return NextResponse.json({ issue }, { status: 200 }) // no-op
    }

    // Re-route for the corrected type (new authority + drafted complaint).
    const routing = await routeIssue({
      issueType,
      area: issue.location.area,
      severity: issue.severity,
      description: issue.description,
    })

    const updated = await store.updateIssue(id, {
      issue_type: issueType,
      authority: {
        name: routing.authority,
        department: routing.department,
        complaint_text: routing.complaint_text,
        escalation_days: routing.escalation_threshold_days,
        helpline: routing.helpline,
        priority_flag: routing.priority_flag,
      },
    })

    return NextResponse.json({ issue: updated }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

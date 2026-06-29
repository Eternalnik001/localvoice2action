// ============================================================
// POST /api/verify-resolution — Agent 5 (before/after vision).
// multipart/form-data: { issueId, afterPhoto }. Fetches the issue's original
// photo + description, runs the Resolution Verifier, and maps the verdict onto
// the real Issue fields: status (RESOLVED only when verdict==='resolved'),
// photos.resolution (the after photo), resolution_verified, resolution_reasoning,
// resolved_at. Returns { verdict, confidence, reasoning }. Server-only.
// ============================================================

import { NextResponse } from "next/server"
import { getStore } from "@/lib/data"
import { verifyResolution } from "@/lib/agents/resolutionVerifier"
import type { Issue } from "@/lib/types"

export const runtime = "nodejs"

async function fetchAsBase64(
  url: string
): Promise<{ data: string; mimeType: string } | null> {
  try {
    if (url.startsWith("data:")) {
      const match = /^data:([^;]+);base64,(.*)$/s.exec(url)
      if (!match) return null
      return { mimeType: match[1] ?? "image/jpeg", data: match[2] ?? "" }
    }
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    return {
      mimeType: res.headers.get("content-type") ?? "image/jpeg",
      data: buf.toString("base64"),
    }
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const issueId = form.get("issueId")
    const afterPhoto = form.get("afterPhoto")

    if (typeof issueId !== "string" || !issueId) {
      return NextResponse.json({ error: "issueId is required." }, { status: 400 })
    }
    if (!(afterPhoto instanceof File)) {
      return NextResponse.json(
        { error: "An afterPhoto file is required." },
        { status: 400 }
      )
    }

    const store = getStore()
    const issue = await store.getIssue(issueId)
    if (!issue) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 })
    }

    const before = await fetchAsBase64(issue.photos.original)
    if (!before) {
      return NextResponse.json(
        { error: "Could not read the original photo for comparison." },
        { status: 422 }
      )
    }

    const afterMime = afterPhoto.type || "image/jpeg"
    const afterBase64 = Buffer.from(await afterPhoto.arrayBuffer()).toString(
      "base64"
    )
    // In-memory only — no cloud storage, zero cost
    const afterDataUri = `data:${afterMime};base64,${afterBase64}`

    const result = await verifyResolution({
      beforeBase64: before.data,
      // Both images must share one mimeType in the agent; use the after photo's.
      afterBase64,
      mimeType: afterMime,
      issueType: issue.issue_type,
      originalDescription: issue.description,
    })

    // Map the verdict onto the real Issue fields.
    const patch: Partial<Issue> = {
      photos: { ...issue.photos, resolution: afterDataUri },
      resolution_reasoning: result.reasoning,
      resolution_verified: result.verdict === "resolved",
      status: result.verdict === "resolved" ? "RESOLVED" : issue.status,
      resolved_at: result.verdict === "resolved" ? new Date() : issue.resolved_at,
    }
    await store.updateIssue(issueId, patch)

    return NextResponse.json(
      {
        verdict: result.verdict,
        confidence: result.confidence,
        reasoning: result.reasoning,
      },
      { status: 200 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

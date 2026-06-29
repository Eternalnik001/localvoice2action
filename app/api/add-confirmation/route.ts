// ============================================================
// POST /api/add-confirmation — the dedup "add my photo to make it louder" path.
// multipart/form-data: { issueId, photo }. Runs the Community Validator
// (Agent 4) to cross-check the new photo against the issue's original, and on
// a positive validation appends the photo + records a "still there" vote so
// the report gets louder. Returns { confirmed: boolean }. Server-only.
// ============================================================

import { NextResponse } from "next/server"
import { getStore } from "@/lib/data"
import { validateCommunityPhoto } from "@/lib/agents/communityValidator"
import { hashIp, clientIpFrom } from "@/lib/security/iphash"

export const runtime = "nodejs"

async function fetchAsBase64(
  url: string
): Promise<{ data: string; mimeType: string } | null> {
  try {
    // Seed photos are remote URLs; uploaded photos are data: URIs.
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
    const photo = form.get("photo")

    if (typeof issueId !== "string" || !issueId) {
      return NextResponse.json(
        { error: "issueId is required." },
        { status: 400 }
      )
    }
    if (!(photo instanceof File)) {
      return NextResponse.json(
        { error: "A photo file is required." },
        { status: 400 }
      )
    }

    const store = getStore()
    const issue = await store.getIssue(issueId)
    if (!issue) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 })
    }

    const verifierMime = photo.type || "image/jpeg"
    const verifierBase64 = Buffer.from(await photo.arrayBuffer()).toString(
      "base64"
    )
    // In-memory only — no cloud storage, zero cost
    const verifierDataUri = `data:${verifierMime};base64,${verifierBase64}`

    // Cross-check against the original photo via Agent 4.
    const original = await fetchAsBase64(issue.photos.original)
    let confirmed = false
    if (original) {
      const verdict = await validateCommunityPhoto({
        originalBase64: original.data,
        originalMimeType: original.mimeType,
        verifierBase64,
        verifierMimeType: verifierMime,
        description: issue.description,
        upvotes: issue.confirmations?.still_there ?? issue.upvotes,
      })
      confirmed = verdict.validation === "CONFIRMED"
    }

    // On confirmation: attach the photo + record a "still there" vote (louder)
    // + stamp the corroborator's token so they earn the Truth Checker badge.
    const ipHash = hashIp(clientIpFrom(request.headers))
    if (confirmed) {
      await store.addConfirmationPhoto(issueId, verifierDataUri)
      await store.recordConfirmation(issueId, "STILL_THERE", ipHash)
      const existing = issue.truth_checker_tokens ?? []
      if (!existing.includes(ipHash)) {
        await store.updateIssue(issueId, {
          truth_checker_tokens: [...existing, ipHash],
        })
      }
    }

    return NextResponse.json({ confirmed }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

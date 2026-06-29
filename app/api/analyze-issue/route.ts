// ============================================================
// POST /api/analyze-issue — orchestrates Agents 1 → 2 → 6 (sequential).
// Server-only (route handlers never run on the client). The agents are pure
// functions; ALL persistence happens here via the data-access layer.
//
// Sequence matters: dedup (2) needs the issue type from vision (1); impact (6)
// needs type + severity + description from vision.
// ============================================================

import { NextResponse } from "next/server"
import { assertGeminiEnv } from "@/lib/gemini/client"
import { analyzePhoto } from "@/lib/agents/visionAnalyst"
import { findDuplicate } from "@/lib/agents/dedupAgent"
import { estimateImpact } from "@/lib/agents/impactEstimator"
import { routeIssue } from "@/lib/agents/routingAgent"
import {
  getAreaFromCoords,
  isInsideBengaluru,
} from "@/lib/utils/reverseGeocode"
import { wardForArea } from "@/lib/data/wardMapping"
import { hashIp, clientIpFrom } from "@/lib/security/iphash"
import { deriveBadgesForToken } from "@/lib/badges"
import { getStore } from "@/lib/data"
import type { CreateIssueInput } from "@/lib/data"
import type { Severity } from "@/lib/types"

export const runtime = "nodejs"

function toLowerSeverity(s: Severity): "low" | "medium" | "high" | "critical" {
  return s.toLowerCase() as "low" | "medium" | "high" | "critical"
}

export async function POST(request: Request) {
  try {
    // Fail fast with a clear error if the server has no Gemini key.
    assertGeminiEnv()

    // --- Parse multipart/form-data ---
    const form = await request.formData()
    const photo = form.get("photo")
    const latRaw = form.get("lat")
    const lngRaw = form.get("lng")
    const area = form.get("area")

    if (!(photo instanceof File)) {
      return NextResponse.json(
        { error: "A photo file is required." },
        { status: 400 }
      )
    }
    const lat = Number(latRaw)
    const lng = Number(lngRaw)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json(
        { error: "Valid lat and lng are required." },
        { status: 400 }
      )
    }

    // --- Edge case: coordinates outside Bengaluru entirely (wrong GPS / another city) ---
    if (!isInsideBengaluru(lat, lng)) {
      return NextResponse.json(
        {
          error: "This app currently serves Bengaluru only",
          outsideBengaluru: true,
        },
        { status: 200 }
      )
    }

    // --- Resolve the area from the COORDINATES (not a trusted client field). ---
    // The client-sent `area` is only a hint; the coordinate-derived name wins.
    void area // form hint, intentionally superseded by reverse geocoding
    const areaStr = await getAreaFromCoords(lat, lng)

    // --- File → base64 + mimeType ---
    const mimeType = photo.type || "image/jpeg"
    const arrayBuffer = await photo.arrayBuffer()
    const photoBase64 = Buffer.from(arrayBuffer).toString("base64")

    // --- 1. Vision Analyst ---
    const vision = await analyzePhoto({ photoBase64, mimeType })
    if (vision === null) {
      return NextResponse.json(
        {
          error:
            "Could not classify image. Please upload a clear photo of the issue.",
        },
        { status: 400 }
      )
    }

    // --- 2. Dedup (needs vision.type) ---
    const candidates = await getStore().findNearbyOpenIssues(
      lat,
      lng,
      vision.type,
      500
    )
    const dedup = await findDuplicate({
      issueType: vision.type,
      lat,
      lng,
      candidatesWithin500m: candidates,
    })

    // --- 6. Impact (needs vision.type/severity/description) ---
    const impact = await estimateImpact({
      issueType: vision.type,
      severity: toLowerSeverity(vision.severity),
      area: areaStr,
      description: vision.description,
    })

    // --- 6a. Merge path: don't create; invite the user to strengthen the existing report ---
    if (dedup.action === "merge") {
      const matched = candidates.find((c) => c.id === dedup.duplicateId)
      return NextResponse.json(
        {
          action: "merge",
          duplicateId: dedup.duplicateId,
          friendlyMessage: dedup.friendlyMessage,
          duplicatePhotoUrl: matched?.photos.original ?? null,
          duplicateTitle: matched?.title ?? null,
          impact,
        },
        { status: 200 }
      )
    }

    // --- 3. Routing (Agent 3): which authority + drafted complaint. Always resolves. ---
    const routing = await routeIssue({
      issueType: vision.type,
      area: areaStr,
      severity: vision.severity,
      description: vision.description,
    })
    const ward = wardForArea(areaStr)

    // --- 7. Create path: persist a new issue (store assigns id/timestamps/defaults) ---
    // In-memory only — no cloud storage, zero cost
    const dataUri = `data:${mimeType};base64,${photoBase64}`
    const input: CreateIssueInput = {
      title: vision.suggestedTitle,
      description: vision.description,
      issue_type: vision.type,
      severity: vision.severity,
      location: {
        lat,
        lng,
        address: areaStr,
        ward: ward.ward,
        area: areaStr,
      },
      photos: { original: dataUri, resolution: null },
      authority: {
        name: routing.authority,
        department: routing.department,
        complaint_text: routing.complaint_text,
        escalation_days: routing.escalation_threshold_days,
        helpline: routing.helpline,
        priority_flag: routing.priority_flag,
      },
      reporter_uid: "anonymous",
      // Anonymous reporter identity (salted IP-hash) for derived badges.
      reporter_token: hashIp(clientIpFrom(request.headers)),
      gemini_confidence: vision.confidence,
    }

    const issue = await getStore().createIssue(input)

    // Derive the reporter's badges AFTER this issue exists, for gamification copy.
    const allIssues = await getStore().listIssues()
    const badges = input.reporter_token
      ? deriveBadgesForToken(input.reporter_token, allIssues)
      : []

    return NextResponse.json(
      { action: "create", issue, impact, routing, badges },
      { status: 200 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

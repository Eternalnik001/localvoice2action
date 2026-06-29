// ============================================================
// POST /api/seed-firestore — one-time loader that writes the demo issues into
// Firestore. Needed because the Firestore driver starts from an EMPTY `issues`
// collection; without this the deployed app would show no data.
//
// SAFE BY DEFAULT: does nothing unless SEED_TOKEN is set AND the caller passes
// the matching ?token=. Also a no-op when Firestore isn't configured, and
// idempotent (skips if `issues` already has data unless ?force=1).
//
// Usage (once, after deploying with Firebase creds + SEED_TOKEN set):
//   curl -X POST "https://<your-url>/api/seed-firestore?token=YOUR_SEED_TOKEN"
// ============================================================

import { NextResponse } from "next/server"
import { getAdminDb } from "@/lib/firebase/admin"
import { getSeedIssues } from "@/lib/data/seed"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get("token")
  const force = url.searchParams.get("force") === "1"

  // Inert unless an operator explicitly opts in by configuring SEED_TOKEN.
  if (!process.env.SEED_TOKEN || token !== process.env.SEED_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const db = getAdminDb()
  if (!db) {
    return NextResponse.json(
      { error: "Firestore is not configured (FIREBASE_ADMIN_* unset)." },
      { status: 400 }
    )
  }

  // Idempotency guard: don't clobber an already-populated collection.
  const existing = await db.collection("issues").limit(1).get()
  if (!existing.empty && !force) {
    return NextResponse.json(
      { skipped: true, reason: "issues collection not empty — pass ?force=1 to reseed." },
      { status: 200 }
    )
  }

  const issues = getSeedIssues()
  const batch = db.batch()
  for (const issue of issues) {
    batch.set(db.collection("issues").doc(issue.id), issue)
  }
  await batch.commit()

  return NextResponse.json({ seeded: issues.length }, { status: 200 })
}

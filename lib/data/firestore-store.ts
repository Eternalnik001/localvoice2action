// ============================================================
// Firestore data driver (built, NOT selected unless FIREBASE_ADMIN_* is set).
// Drop-in alternative to the in-memory driver — same DataStore interface, so
// no route or component changes when you swap. Geo query is read-then-filter
// via Haversine (fine for demo scale; add geohashing for production).
// ============================================================

import { Timestamp, type Firestore } from "firebase-admin/firestore"
import type { Confirmation, ConfirmationVote, Issue } from "@/lib/types"
import { haversineMeters } from "@/lib/maps/utils"
import { computeHeatmapWeight } from "@/lib/maps/heatmap"
import type {
  CreateIssueInput,
  DataStore,
  RecordConfirmationResult,
} from "@/lib/data/types"

const ISSUES = "issues"
const CONFIRMATIONS = "confirmations"
const OPEN_STATUSES: ReadonlyArray<Issue["status"]> = [
  "OPEN",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
]

function toDate(value: unknown): Date {
  if (value instanceof Timestamp) return value.toDate()
  if (value instanceof Date) return value
  if (typeof value === "string" || typeof value === "number") {
    return new Date(value)
  }
  return new Date(0)
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToIssue(id: string, data: any): Issue {
  return {
    ...data,
    id,
    created_at: toDate(data.created_at),
    updated_at: toDate(data.updated_at),
    resolved_at: data.resolved_at ? toDate(data.resolved_at) : null,
    confirmations: data.confirmations
      ? {
          still_there: data.confirmations.still_there ?? 0,
          fixed_now: data.confirmations.fixed_now ?? 0,
          last_updated: data.confirmations.last_updated
            ? toDate(data.confirmations.last_updated)
            : null,
        }
      : undefined,
  } as Issue
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function weightFor(issue: Issue): number {
  return computeHeatmapWeight({
    severity: issue.severity,
    still_there: issue.confirmations?.still_there ?? issue.upvotes,
    fixed_now: issue.confirmations?.fixed_now ?? 0,
    created_at: issue.created_at,
  })
}

class FirestoreStore implements DataStore {
  constructor(private db: Firestore) {}

  async listIssues(): Promise<Issue[]> {
    const snap = await this.db.collection(ISSUES).get()
    return snap.docs
      .map((d) => rowToIssue(d.id, d.data()))
      .filter((i) => i.duplicate_of === null)
  }

  async getIssue(id: string): Promise<Issue | null> {
    const doc = await this.db.collection(ISSUES).doc(id).get()
    return doc.exists ? rowToIssue(doc.id, doc.data()) : null
  }

  async createIssue(input: CreateIssueInput): Promise<Issue> {
    const now = new Date()
    const ref = this.db.collection(ISSUES).doc()
    const issue: Issue = {
      id: ref.id,
      title: input.title,
      description: input.description,
      issue_type: input.issue_type,
      severity: input.severity,
      status: "OPEN",
      location: input.location,
      photos: input.photos,
      authority: input.authority,
      reporter_uid: input.reporter_uid,
      reporter_display_name: input.reporter_display_name,
      reporter_token: input.reporter_token,
      upvotes: 0,
      upvoted_by: [],
      verification_status: "UNVERIFIED",
      gemini_confidence: input.gemini_confidence,
      created_at: now,
      updated_at: now,
      resolved_at: null,
      resolution_verified: false,
      resolution_reasoning: null,
      duplicate_of: null,
      confirmations: { still_there: 0, fixed_now: 0, last_updated: null },
      additional_photos: [],
    }
    issue.heatmap_weight = weightFor(issue)
    await ref.set(issue)
    return issue
  }

  async updateIssue(id: string, patch: Partial<Issue>): Promise<Issue> {
    const ref = this.db.collection(ISSUES).doc(id)
    const current = await ref.get()
    if (!current.exists) throw new Error(`Issue not found: ${id}`)
    const merged = rowToIssue(id, { ...current.data(), ...patch })
    merged.updated_at = new Date()
    merged.heatmap_weight = weightFor(merged)
    await ref.set(merged)
    return merged
  }

  async findNearbyOpenIssues(
    lat: number,
    lng: number,
    issueType: Issue["issue_type"],
    radiusM: number
  ): Promise<Issue[]> {
    const snap = await this.db
      .collection(ISSUES)
      .where("issue_type", "==", issueType)
      .get()
    return snap.docs
      .map((d) => rowToIssue(d.id, d.data()))
      .filter(
        (i) =>
          i.duplicate_of === null &&
          OPEN_STATUSES.includes(i.status) &&
          haversineMeters(
            { lat, lng },
            { lat: i.location.lat, lng: i.location.lng }
          ) <= radiusM
      )
      .sort(
        (a, b) =>
          haversineMeters(
            { lat, lng },
            { lat: a.location.lat, lng: a.location.lng }
          ) -
          haversineMeters(
            { lat, lng },
            { lat: b.location.lat, lng: b.location.lng }
          )
      )
  }

  async hasRecentConfirmation(
    issueId: string,
    ipHash: string,
    windowMs: number
  ): Promise<boolean> {
    const cutoff = Timestamp.fromMillis(Date.now() - windowMs)
    const snap = await this.db
      .collection(CONFIRMATIONS)
      .where("issue_id", "==", issueId)
      .where("ip_hash", "==", ipHash)
      .where("created_at", ">=", cutoff)
      .limit(1)
      .get()
    return !snap.empty
  }

  async recordConfirmation(
    issueId: string,
    vote: ConfirmationVote,
    ipHash: string
  ): Promise<RecordConfirmationResult> {
    const issue = await this.getIssue(issueId)
    if (!issue) return { accepted: false, reason: "not_found", issue: null }

    const now = new Date()
    const confirmation: Confirmation = {
      issue_id: issueId,
      vote,
      ip_hash: ipHash,
      created_at: now,
    }
    await this.db.collection(CONFIRMATIONS).add(confirmation)

    const confirmations = issue.confirmations ?? {
      still_there: 0,
      fixed_now: 0,
      last_updated: null,
    }
    if (vote === "STILL_THERE") {
      confirmations.still_there += 1
      issue.upvotes += 1
    } else {
      confirmations.fixed_now += 1
    }
    confirmations.last_updated = now

    const updated = await this.updateIssue(issueId, {
      confirmations,
      upvotes: issue.upvotes,
    })
    return { accepted: true, issue: updated }
  }

  async addConfirmationPhoto(
    issueId: string,
    photoUrl: string
  ): Promise<Issue> {
    const issue = await this.getIssue(issueId)
    if (!issue) throw new Error(`Issue not found: ${issueId}`)
    return this.updateIssue(issueId, {
      additional_photos: [...(issue.additional_photos ?? []), photoUrl],
    })
  }
}

export function createFirestoreStore(db: Firestore): DataStore {
  return new FirestoreStore(db)
}

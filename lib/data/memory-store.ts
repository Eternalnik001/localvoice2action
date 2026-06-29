// ============================================================
// In-memory data driver (DEFAULT for the demo).
// Holds issues + confirmations in module-scope Maps, seeded once. Makes the
// whole app runnable with empty Firebase keys. Geo queries use the shared
// Haversine helper; every vote recomputes heatmap_weight (code rule #7).
//
// NOTE: module-scope state resets on server restart / per serverless instance.
// That's fine for a single-instance hackathon demo; the Firestore driver is
// the durable swap.
// ============================================================

import type { Confirmation, ConfirmationVote, Issue } from "@/lib/types"
import { haversineMeters } from "@/lib/maps/utils"
import { computeHeatmapWeight } from "@/lib/maps/heatmap"
import { getSeedIssues } from "@/lib/data/seed"
import type {
  CreateIssueInput,
  DataStore,
  RecordConfirmationResult,
} from "@/lib/data/types"

const OPEN_STATUSES: ReadonlyArray<Issue["status"]> = [
  "OPEN",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
]

function weightFor(issue: Issue): number {
  return computeHeatmapWeight({
    severity: issue.severity,
    still_there: issue.confirmations?.still_there ?? issue.upvotes,
    fixed_now: issue.confirmations?.fixed_now ?? 0,
    created_at: issue.created_at,
  })
}

class MemoryStore implements DataStore {
  private issues = new Map<string, Issue>()
  private confirmations: Confirmation[] = []
  private counter = 0

  constructor() {
    for (const issue of getSeedIssues()) {
      issue.heatmap_weight = weightFor(issue)
      this.issues.set(issue.id, issue)
    }
  }

  async listIssues(): Promise<Issue[]> {
    // Hide issues merged into a parent (shown via the parent's count instead).
    return [...this.issues.values()].filter((i) => i.duplicate_of === null)
  }

  async getIssue(id: string): Promise<Issue | null> {
    return this.issues.get(id) ?? null
  }

  async createIssue(input: CreateIssueInput): Promise<Issue> {
    this.counter += 1
    const now = new Date()
    const id = `issue-${now.getTime()}-${this.counter}`
    const issue: Issue = {
      id,
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
    this.issues.set(id, issue)
    return issue
  }

  async updateIssue(id: string, patch: Partial<Issue>): Promise<Issue> {
    const existing = this.issues.get(id)
    if (!existing) throw new Error(`Issue not found: ${id}`)
    const updated: Issue = { ...existing, ...patch, updated_at: new Date() }
    updated.heatmap_weight = weightFor(updated)
    this.issues.set(id, updated)
    return updated
  }

  async findNearbyOpenIssues(
    lat: number,
    lng: number,
    issueType: Issue["issue_type"],
    radiusM: number
  ): Promise<Issue[]> {
    return [...this.issues.values()]
      .filter(
        (i) =>
          i.duplicate_of === null &&
          i.issue_type === issueType &&
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
    const cutoff = Date.now() - windowMs
    return this.confirmations.some(
      (c) =>
        c.issue_id === issueId &&
        c.ip_hash === ipHash &&
        c.created_at.getTime() >= cutoff
    )
  }

  async recordConfirmation(
    issueId: string,
    vote: ConfirmationVote,
    ipHash: string
  ): Promise<RecordConfirmationResult> {
    const issue = this.issues.get(issueId)
    if (!issue) return { accepted: false, reason: "not_found", issue: null }

    const now = new Date()
    this.confirmations.push({
      issue_id: issueId,
      vote,
      ip_hash: ipHash,
      created_at: now,
    })

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

    // Auto-escalation: sustained "Still There" pressure (≥10) bumps a NORMAL
    // issue to URGENT so the authority sees the community signal.
    const escalate =
      confirmations.still_there >= 10 &&
      issue.status !== "RESOLVED" &&
      issue.status !== "CLOSED" &&
      issue.authority.priority_flag === "NORMAL"

    const updated: Issue = {
      ...issue,
      authority: escalate
        ? { ...issue.authority, priority_flag: "URGENT" }
        : issue.authority,
      confirmations,
      updated_at: now,
    }
    updated.heatmap_weight = weightFor(updated)
    this.issues.set(issueId, updated)
    return { accepted: true, issue: updated }
  }

  async addConfirmationPhoto(
    issueId: string,
    photoUrl: string
  ): Promise<Issue> {
    const issue = this.issues.get(issueId)
    if (!issue) throw new Error(`Issue not found: ${issueId}`)
    const updated: Issue = {
      ...issue,
      additional_photos: [...(issue.additional_photos ?? []), photoUrl],
      updated_at: new Date(),
    }
    this.issues.set(issueId, updated)
    return updated
  }
}

// Single shared instance across the server process (survives across requests
// within one instance). Stashed on globalThis so Next.js dev hot-reload
// doesn't wipe it on every edit.
const globalForStore = globalThis as unknown as {
  __lv2aMemoryStore?: MemoryStore
}

export function getMemoryStore(): DataStore {
  if (!globalForStore.__lv2aMemoryStore) {
    globalForStore.__lv2aMemoryStore = new MemoryStore()
  }
  return globalForStore.__lv2aMemoryStore
}

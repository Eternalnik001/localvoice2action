// ============================================================
// Data-access layer (DAL) — driver interface.
// Route handlers talk to a DataStore; the DataStore talks to a driver
// (in-memory for the demo, Firestore when configured). This keeps agent
// files pure (no Firestore inside them) and lets the whole app run without
// any Firebase provisioning.
// ============================================================

import type { ConfirmationVote, Issue } from "@/lib/types"

/** Fields required to create a new issue; the store assigns id/timestamps/defaults. */
export interface CreateIssueInput {
  title: string
  description: string
  issue_type: Issue["issue_type"]
  severity: Issue["severity"]
  location: Issue["location"]
  photos: Issue["photos"]
  authority: Issue["authority"]
  reporter_uid: string
  reporter_display_name?: string
  /** Anonymous salted IP-hash of the reporter — powers derived badges. */
  reporter_token?: string
  gemini_confidence: number
}

export interface RecordConfirmationResult {
  accepted: boolean
  /** Set when accepted is false, e.g. "already voted in the last 24h". */
  reason?: string
  /** The issue after the vote (present whether or not the vote was accepted). */
  issue: Issue | null
}

export interface DataStore {
  listIssues(): Promise<Issue[]>
  getIssue(id: string): Promise<Issue | null>
  createIssue(input: CreateIssueInput): Promise<Issue>
  updateIssue(id: string, patch: Partial<Issue>): Promise<Issue>
  /** Open issues of the same type within radiusM of (lat,lng) — powers dedup. */
  findNearbyOpenIssues(
    lat: number,
    lng: number,
    issueType: Issue["issue_type"],
    radiusM: number
  ): Promise<Issue[]>
  /** Has this hashed IP voted on this issue within windowMs? */
  hasRecentConfirmation(
    issueId: string,
    ipHash: string,
    windowMs: number
  ): Promise<boolean>
  /** Record a vote (dedup enforced by caller via hasRecentConfirmation) and recompute heatmap_weight. */
  recordConfirmation(
    issueId: string,
    vote: ConfirmationVote,
    ipHash: string
  ): Promise<RecordConfirmationResult>
  /** Append a confirming photo (the dedup "add my photo" path). */
  addConfirmationPhoto(issueId: string, photoUrl: string): Promise<Issue>
}

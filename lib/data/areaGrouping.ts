// ============================================================
// Dynamic area grouping — pure function.
// Groups issues by their resolved location.area, with NO hardcoded area list.
// If 3 citizens report in "Sarjapur", a "Sarjapur" group appears automatically
// — no code change. The home map / any clustered view consumes this.
// ============================================================

import type { Issue } from "@/lib/types"

export interface AreaGroup {
  area: string
  issues: Issue[]
  count: number
  /** Group centroid (mean of member coords) — a natural map cluster anchor. */
  centroid: { lat: number; lng: number }
  /** Sum of still-there confirmations across the group (signal strength). */
  totalStillThere: number
}

/**
 * Group issues by area name (case-insensitively; the first-seen casing is kept
 * as the display label). Returns groups sorted by issue count, descending.
 */
export function groupIssuesByArea(issues: Issue[]): AreaGroup[] {
  const groups = new Map<string, { label: string; issues: Issue[] }>()

  for (const issue of issues) {
    const raw = issue.location.area?.trim() || "Bengaluru"
    const key = raw.toLowerCase()
    const existing = groups.get(key)
    if (existing) {
      existing.issues.push(issue)
    } else {
      groups.set(key, { label: raw, issues: [issue] })
    }
  }

  const result: AreaGroup[] = []
  for (const { label, issues: groupIssues } of groups.values()) {
    const n = groupIssues.length
    const sumLat = groupIssues.reduce((s, i) => s + i.location.lat, 0)
    const sumLng = groupIssues.reduce((s, i) => s + i.location.lng, 0)
    const totalStillThere = groupIssues.reduce(
      (s, i) => s + (i.confirmations?.still_there ?? i.upvotes),
      0
    )
    result.push({
      area: label,
      issues: groupIssues,
      count: n,
      centroid: { lat: sumLat / n, lng: sumLng / n },
      totalStillThere,
    })
  }

  return result.sort((a, b) => b.count - a.count)
}

// ============================================================
// Dashboard aggregations — pure functions over the issue list.
// Server-safe (no DOM, no Gemini). Powers the public accountability dashboard.
// ============================================================

import type { Issue, IssueType } from "@/lib/types"
import { groupIssuesByArea } from "@/lib/data/areaGrouping"
import { topBadgeForArea, type Badge } from "@/lib/badges"
import { nicknameForIp } from "@/lib/data/citizens"

export interface CityStats {
  totalReported: number
  resolvedThisMonth: number
  resolvedThisMonthPct: number
  avgResolutionDays: number | null
  mostActiveArea: { area: string; count: number } | null
}

export interface CategoryDatum {
  type: IssueType
  label: string
  count: number
}

export interface AreaResolutionDatum {
  area: string
  open: number
  resolved: number
}

const MONTH_MS = 30 * 24 * 60 * 60 * 1000

const TYPE_LABEL: Record<IssueType, string> = {
  POTHOLE: "Pothole",
  WATER_LEAKAGE: "Water leak",
  BROKEN_STREETLIGHT: "Streetlight",
  GARBAGE_OVERFLOW: "Garbage",
  DAMAGED_FOOTPATH: "Footpath",
  ENCROACHMENT: "Encroachment",
  OTHER: "Other",
  NOT_A_CIVIC_ISSUE: "Not civic",
}

/** Section 1 — city-wide headline metrics. `now` injected for deterministic SSR. */
export function computeCityStats(issues: Issue[], now: number): CityStats {
  const total = issues.length
  const monthAgo = now - MONTH_MS

  const resolved = issues.filter((i) => i.status === "RESOLVED")
  const resolvedThisMonth = resolved.filter(
    (i) => i.resolved_at != null && i.resolved_at.getTime() >= monthAgo
  ).length

  // Average resolution time over all resolved issues that have both timestamps.
  const durations = resolved
    .filter((i) => i.resolved_at != null)
    .map((i) => (i.resolved_at!.getTime() - i.created_at.getTime()) / 86_400_000)
    .filter((d) => d >= 0)
  const avgResolutionDays =
    durations.length > 0
      ? Math.round(
          (durations.reduce((s, d) => s + d, 0) / durations.length) * 10
        ) / 10
      : null

  const groups = groupIssuesByArea(issues)
  const mostActiveArea =
    groups.length > 0 ? { area: groups[0]!.area, count: groups[0]!.count } : null

  return {
    totalReported: total,
    resolvedThisMonth,
    resolvedThisMonthPct:
      total > 0 ? Math.round((resolvedThisMonth / total) * 100) : 0,
    avgResolutionDays,
    mostActiveArea,
  }
}

/** Section 2 — counts per issue type (descending, non-zero only). */
export function computeByCategory(issues: Issue[]): CategoryDatum[] {
  const counts = new Map<IssueType, number>()
  for (const i of issues) {
    counts.set(i.issue_type, (counts.get(i.issue_type) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([type, count]) => ({ type, label: TYPE_LABEL[type], count }))
    .sort((a, b) => b.count - a.count)
}

/** Section 3 — open vs resolved per area (top areas by total). */
export function computeAreaResolution(
  issues: Issue[],
  topN = 6
): AreaResolutionDatum[] {
  const groups = groupIssuesByArea(issues).slice(0, topN)
  return groups.map((g) => {
    const resolved = g.issues.filter((i) => i.status === "RESOLVED").length
    return {
      area: g.area,
      open: g.count - resolved,
      resolved,
    }
  })
}

/** Section 4 — last N issues by recency. */
export function recentActivity(issues: Issue[], n = 10): Issue[] {
  return [...issues]
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    .slice(0, n)
}

export interface LeaderboardRow {
  area: string
  /** Lead reporter's saved nickname, or null → render "Anonymous Neighbour". */
  nickname: string | null
  reports: number
  resolved: number
  resolutionRate: number // 0..100
  score: number
  topBadge: Badge | null
}

/** Earliest reporter token in an area (its "lead reporter"). */
function leadReporterToken(area: string, issues: Issue[]): string | null {
  const inArea = issues
    .filter((i) => i.location.area === area && i.reporter_token)
    .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
  return inArea[0]?.reporter_token ?? null
}

/** Section 5 — neighbourhood leaderboard (weighted reports + resolved). */
export function computeLeaderboard(issues: Issue[], topN = 5): LeaderboardRow[] {
  const groups = groupIssuesByArea(issues)
  const rows: LeaderboardRow[] = groups.map((g) => {
    const reports = g.count
    const resolved = g.issues.filter((i) => i.status === "RESOLVED").length
    // Show the lead reporter's nickname only if they registered one (Tier 2).
    const lead = leadReporterToken(g.area, issues)
    const nickname = lead ? nicknameForIp(lead) : null
    return {
      area: g.area,
      nickname,
      reports,
      resolved,
      resolutionRate: reports > 0 ? Math.round((resolved / reports) * 100) : 0,
      // Weighted: every report counts, resolutions count double (engagement + outcome).
      score: reports + resolved * 2,
      topBadge: topBadgeForArea(g.area, issues),
    }
  })
  return rows.sort((a, b) => b.score - a.score).slice(0, topN)
}

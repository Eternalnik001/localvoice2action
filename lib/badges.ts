// ============================================================
// Anonymous citizen badges — DERIVED from issue data (no separate store,
// no accounts). A reporter is identified only by an anonymous salted IP-hash
// (reporter_token) stamped on issues they create. Badges are computed by
// scanning that token's issues, so they can never drift from reality.
// ============================================================

import type { Issue, CommunityBadge, IssueType } from "@/lib/types"

export type BadgeId =
  | "FIRST_REPORTER"
  | "VIGILANT_NEIGHBOUR"
  | "TRUTH_CHECKER"
  | "RESOLUTION_WITNESS"
  | "LOUD_VOICE"

export interface Badge {
  id: BadgeId
  label: string
  emoji: string
  description: string
}

export const BADGES: Record<BadgeId, Badge> = {
  FIRST_REPORTER: {
    id: "FIRST_REPORTER",
    label: "First Reporter",
    emoji: "🥇",
    description: "Reported the first issue in their area",
  },
  VIGILANT_NEIGHBOUR: {
    id: "VIGILANT_NEIGHBOUR",
    label: "Vigilant Neighbour",
    emoji: "🏅",
    description: "Reported 3 or more issues",
  },
  TRUTH_CHECKER: {
    id: "TRUTH_CHECKER",
    label: "Truth Checker",
    emoji: "🔍",
    description: "Submitted a corroborating photo confirmed by AI",
  },
  RESOLUTION_WITNESS: {
    id: "RESOLUTION_WITNESS",
    label: "Resolution Witness",
    emoji: "✅",
    description: "Submitted an after photo that verified a fix",
  },
  LOUD_VOICE: {
    id: "LOUD_VOICE",
    label: "Loud Voice",
    emoji: "📣",
    description: "A report got 10 or more community votes",
  },
}

const LOUD_VOICE_THRESHOLD = 10
const VIGILANT_THRESHOLD = 3

function stillThere(issue: Issue): number {
  return issue.confirmations?.still_there ?? issue.upvotes
}

/** Is this token the earliest reporter in its area (per the issue set)? */
function isFirstInArea(token: string, mine: Issue[], all: Issue[]): boolean {
  for (const issue of mine) {
    const area = issue.location.area
    const inArea = all
      .filter((i) => i.location.area === area && i.reporter_token)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
    if (inArea[0] && inArea[0].reporter_token === token) return true
  }
  return false
}

/**
 * Derive the badges an anonymous token has earned, by scanning all issues.
 * Pure function — same inputs always yield the same badges.
 */
export function deriveBadgesForToken(token: string, all: Issue[]): Badge[] {
  if (!token) return []
  const mine = all.filter((i) => i.reporter_token === token)
  const earned = new Set<BadgeId>()

  // Vigilant Neighbour — 3+ issues reported.
  if (mine.length >= VIGILANT_THRESHOLD) earned.add("VIGILANT_NEIGHBOUR")

  // Loud Voice — any of their reports has 10+ community votes.
  if (mine.some((i) => stillThere(i) >= LOUD_VOICE_THRESHOLD)) {
    earned.add("LOUD_VOICE")
  }

  // First Reporter — earliest reporter in at least one area.
  if (mine.length > 0 && isFirstInArea(token, mine, all)) {
    earned.add("FIRST_REPORTER")
  }

  // Resolution Witness — verified an after-photo on some issue.
  if (all.some((i) => i.resolution_witness_token === token)) {
    earned.add("RESOLUTION_WITNESS")
  }

  // Truth Checker — a corroborating photo of theirs was AI-confirmed
  // (stamped by the add-confirmation flow onto the issue they corroborated).
  if (all.some((i) => i.truth_checker_tokens?.includes(token))) {
    earned.add("TRUTH_CHECKER")
  }

  return [...earned].map((id) => BADGES[id])
}

/**
 * Which single badge "represents" an area — the rarest badge earned by any
 * reporter in that area (for the leaderboard's "top badge" column).
 */
const BADGE_RANK: BadgeId[] = [
  "RESOLUTION_WITNESS",
  "LOUD_VOICE",
  "TRUTH_CHECKER",
  "VIGILANT_NEIGHBOUR",
  "FIRST_REPORTER",
]

export function topBadgeForArea(area: string, all: Issue[]): Badge | null {
  const tokens = new Set(
    all
      .filter((i) => i.location.area === area && i.reporter_token)
      .map((i) => i.reporter_token as string)
  )
  const earned = new Set<BadgeId>()
  for (const t of tokens) {
    for (const b of deriveBadgesForToken(t, all)) earned.add(b.id)
  }
  for (const id of BADGE_RANK) {
    if (earned.has(id)) return BADGES[id]
  }
  return null
}

// ============================================================
// Axis 2 — Community tier (a single progressive rank) and Expertise badges
// (per issue type, 5 levels). Both DERIVED from the token's reports.
// ============================================================

export interface CommunityTier {
  id: CommunityBadge
  label: string
  emoji: string
  minReports: number
}

/** Ordered low → high. A token holds the highest tier its report count clears. */
export const COMMUNITY_TIERS: CommunityTier[] = [
  { id: "NEIGHBOURHOOD_NEWCOMER", label: "Neighbourhood Newcomer", emoji: "🌱", minReports: 0 },
  { id: "STREET_SENTINEL", label: "Street Sentinel", emoji: "👁️", minReports: 1 },
  { id: "WARD_WATCHDOG", label: "Ward Watchdog", emoji: "🐕", minReports: 3 },
  { id: "COMMUNITY_CHAMPION", label: "Community Champion", emoji: "🏆", minReports: 6 },
  { id: "DISTRICT_GUARDIAN", label: "District Guardian", emoji: "🛡️", minReports: 10 },
]

export interface CommunityTierProgress {
  current: CommunityTier
  next: CommunityTier | null
  reports: number
  reportsToNext: number | null
}

export function communityTierForToken(
  token: string,
  all: Issue[]
): CommunityTierProgress {
  const reports = token
    ? all.filter((i) => i.reporter_token === token).length
    : 0
  let current = COMMUNITY_TIERS[0]!
  for (const t of COMMUNITY_TIERS) if (reports >= t.minReports) current = t
  const idx = COMMUNITY_TIERS.findIndex((t) => t.id === current.id)
  const next = COMMUNITY_TIERS[idx + 1] ?? null
  return {
    current,
    next,
    reports,
    reportsToNext: next ? Math.max(0, next.minReports - reports) : null,
  }
}

export interface ExpertiseConfig {
  type: IssueType
  label: string
  emoji: string
}

/** One expertise track per (citizen-reportable) issue type. */
export const EXPERTISE: ExpertiseConfig[] = [
  { type: "POTHOLE", label: "Pothole Patrol", emoji: "🕳️" },
  { type: "WATER_LEAKAGE", label: "Water Guardian", emoji: "💧" },
  { type: "BROKEN_STREETLIGHT", label: "Light Keeper", emoji: "💡" },
  { type: "GARBAGE_OVERFLOW", label: "Waste Warrior", emoji: "🗑️" },
  { type: "DAMAGED_FOOTPATH", label: "Footpath Defender", emoji: "🚶" },
]

/** Report counts that unlock levels 1..5 (Google Local Guides–style). */
export const EXPERTISE_LEVELS = [1, 3, 6, 10, 20]

export interface ExpertiseProgress {
  type: IssueType
  label: string
  emoji: string
  count: number
  level: number // 0..5
  nextThreshold: number | null // reports needed for the next level (null = maxed)
}

export function expertiseForToken(
  token: string,
  all: Issue[]
): ExpertiseProgress[] {
  const mine = token ? all.filter((i) => i.reporter_token === token) : []
  return EXPERTISE.map((e) => {
    const count = mine.filter((i) => i.issue_type === e.type).length
    let level = 0
    for (const th of EXPERTISE_LEVELS) if (count >= th) level += 1
    const nextThreshold = EXPERTISE_LEVELS[level] ?? null
    return {
      type: e.type,
      label: e.label,
      emoji: e.emoji,
      count,
      level,
      nextThreshold,
    }
  })
}

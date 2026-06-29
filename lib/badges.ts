// ============================================================
// Anonymous citizen badges — DERIVED from issue data (no separate store,
// no accounts). A reporter is identified only by an anonymous salted IP-hash
// (reporter_token) stamped on issues they create. Badges are computed by
// scanning that token's issues, so they can never drift from reality.
// ============================================================

import type { Issue } from "@/lib/types"

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

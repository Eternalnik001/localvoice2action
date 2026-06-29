// ============================================================
// Heatmap weight — pure function.
// Per the spec, the weight is COMMUNITY-AMPLIFIED: a pothole confirmed 40
// times scores far hotter than 40 unconfirmed potholes. Recalculated and
// written to the issue on every confirmation vote (project code rule #7).
// ============================================================

import type { Severity } from "@/lib/types"

const SEVERITY_MULTIPLIER: Record<Severity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
}

const MS_PER_DAY = 86_400_000
const MAX_DAYS = 30

export interface HeatmapWeightInput {
  severity: Severity
  still_there: number
  fixed_now: number
  created_at: Date
  /** Defaults to now(); injectable for deterministic tests. */
  now?: Date
}

/**
 * weight = still_there*2 + fixed_now*0.5 + severityMultiplier + daysUnresolved*0.5
 * with daysUnresolved capped at 30. Community "still there" signal dominates,
 * exactly like Google Maps traffic weighting.
 */
export function computeHeatmapWeight(input: HeatmapWeightInput): number {
  const { severity, still_there, fixed_now, created_at } = input
  const now = input.now ?? new Date()

  const daysSinceCreated = Math.min(
    Math.max(0, (now.getTime() - created_at.getTime()) / MS_PER_DAY),
    MAX_DAYS
  )

  return (
    still_there * 2 +
    fixed_now * 0.5 +
    SEVERITY_MULTIPLIER[severity] +
    daysSinceCreated * 0.5
  )
}

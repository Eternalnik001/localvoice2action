// ============================================================
// Agent 6 — Impact Estimator ("Nearby Citizens / People affected").
// Pure function: issue context -> who is affected, with a warm "you're not
// alone" tagline. Powers the collective-impact card. Calls Gemini via the
// shared generateJson() (JSON-mode) client.
//
// NOTE: this agent's I/O contract (camelCase, `tagline`) is intentionally
// distinct from the snake_case `NearbyCitizens` UI type in lib/types — the
// route layer maps between them. The older IMPACT_SYSTEM_PROMPT/getImpactPrompt
// in lib/gemini/prompts.ts targeted the NearbyCitizens shape and is unused by
// this agent; this file owns the prompt matching ImpactEstimate.
// ============================================================

import { generateJson } from "@/lib/gemini/client"
import type { IssueType } from "@/lib/types"

export interface ImpactEstimatorInput {
  issueType: IssueType
  severity: "low" | "medium" | "high" | "critical"
  area: string
  description: string
}

export interface ImpactEstimate {
  residents: number
  commuters: number
  businesses: number
  deliveryPartners: number
  tagline: string
}

// Per-field Bengaluru-neighbourhood-scale bounds [min, max]. Single source of
// truth: injected into the prompt AND enforced by clamping, so a value can
// never reach the UI outside these ranges.
const BOUNDS = {
  residents: [20, 500],
  commuters: [50, 1000],
  businesses: [2, 50],
  deliveryPartners: [5, 100],
} as const

// Cache prevents repeat Gemini calls for the same photo — critical for demo-day quota.
// Keyed by issueType + area + severity; 1-hour TTL. (Two reports of the same
// issue type in the same area at the same severity get an identical estimate.)
const CACHE_TTL_MS = 60 * 60 * 1000
const impactCache = new Map<string, { value: ImpactEstimate; expires: number }>()

function impactCacheKey(input: ImpactEstimatorInput): string {
  return `${input.issueType}|${input.area.trim().toLowerCase()}|${input.severity}`
}

/** Returned on any Gemini failure or invalid JSON. Never thrown. */
const FALLBACK: ImpactEstimate = {
  residents: 50,
  commuters: 100,
  businesses: 5,
  deliveryPartners: 20,
  tagline: "Your neighbours feel this too.",
}

const SYSTEM_PROMPT = `
You are a civic-impact estimator for Bengaluru, India. Given a civic issue, you
estimate how many people in each cohort are realistically affected day to day,
grounded in Indian urban density and the specific neighbourhood. Be realistic —
numbers should be plausible for one location in Bengaluru, NOT city-wide
(e.g. tens to a few hundred, never tens of thousands). Respond with ONLY valid
JSON — no markdown fences, no preamble, no explanation.
`.trim()

function buildUserPrompt(input: ImpactEstimatorInput): string {
  return `
Estimate who is affected by this civic issue in Bengaluru.
Issue type: ${input.issueType}
Severity: ${input.severity}
Area: ${input.area}
Description: ${input.description}

Return ONLY this exact JSON structure, nothing else:
{
  "residents": 0,
  "commuters": 0,
  "businesses": 0,
  "deliveryPartners": 0,
  "tagline": "one warm, human, collective-impact sentence that NAMES the specific neighbourhood (the Area above)"
}

Rules for the numbers — each MUST fall within these Bengaluru-neighbourhood
bounds (a single location, never city-wide). Stay inside the range even for
low or critical severity; scale gently within the range:
- residents: between ${BOUNDS.residents[0]} and ${BOUNDS.residents[1]}
- commuters: between ${BOUNDS.commuters[0]} and ${BOUNDS.commuters[1]}
- businesses: between ${BOUNDS.businesses[0]} and ${BOUNDS.businesses[1]}
- deliveryPartners: between ${BOUNDS.deliveryPartners[0]} and ${BOUNDS.deliveryPartners[1]}
Rules for the tagline: warm and human, not corporate, and it MUST reference the
actual neighbourhood by name ("${input.area}") — never the generic city.
GOOD: "~75 ${input.area} residents navigate this pothole every single day."
BAD (too generic): "~75 Bengaluru residents navigate this pothole every day."
More tone examples:
"This broken streetlight leaves roughly 120 ${input.area} families in the dark."
`.trim()
}

function isImpactEstimate(value: unknown): value is ImpactEstimate {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.residents === "number" &&
    typeof v.commuters === "number" &&
    typeof v.businesses === "number" &&
    typeof v.deliveryPartners === "number" &&
    typeof v.tagline === "string" &&
    v.tagline.trim().length > 0
  )
}

/**
 * Estimate the human impact of a civic issue. Always resolves — returns the
 * warm FALLBACK estimate on any Gemini error or invalid/implausible JSON, so
 * the card always has something kind to show. Never throws.
 */
export async function estimateImpact(
  input: ImpactEstimatorInput
): Promise<ImpactEstimate> {
  // Cache hit → skip Gemini entirely.
  const key = impactCacheKey(input)
  const hit = impactCache.get(key)
  if (hit && hit.expires > Date.now()) return hit.value

  let result: unknown
  try {
    result = await generateJson<unknown>({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(input),
    })
  } catch {
    return FALLBACK
  }

  if (!isImpactEstimate(result)) return FALLBACK

  // Per-field clamp into the Bengaluru-neighbourhood bounds, so a value outside
  // the agreed range never reaches the UI even if the model strays.
  const clamp = (n: number, [lo, hi]: readonly [number, number]): number =>
    Math.max(lo, Math.min(hi, Math.round(n)))

  const estimate: ImpactEstimate = {
    residents: clamp(result.residents, BOUNDS.residents),
    commuters: clamp(result.commuters, BOUNDS.commuters),
    businesses: clamp(result.businesses, BOUNDS.businesses),
    deliveryPartners: clamp(result.deliveryPartners, BOUNDS.deliveryPartners),
    tagline: result.tagline.trim(),
  }

  // Only cache successful estimates — never cache the FALLBACK (so a transient
  // quota/error doesn't pin a generic estimate for an hour).
  impactCache.set(key, { value: estimate, expires: Date.now() + CACHE_TTL_MS })
  return estimate
}

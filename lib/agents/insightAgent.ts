// ============================================================
// Insight Agent — Gemini-powered predictive dashboard insights.
// Pure function: the full issue list + city stats -> exactly 3 "InsightCard"s
// written in warm, hyperlocal Bengaluru language (monsoon patterns,
// infrastructure cycles, BWSSB/BBMP context). Calls Gemini via the shared
// generateJson() (JSON-mode) client.
//
// Never throws. On any Gemini failure or invalid JSON it returns 2 hardcoded
// static insights so the dashboard's insight section never renders empty.
// Cost note: caching/TTL lives in the route (one call per hour, max) — the
// agent itself stays a pure, side-effect-free generator.
// ============================================================

import { generateJson } from "@/lib/gemini/client"
import { computeByCategory, type CityStats } from "@/lib/data/dashboardStats"
import { groupIssuesByArea } from "@/lib/data/areaGrouping"
import type { Issue } from "@/lib/types"

export type InsightType = "trend" | "prediction" | "hotspot" | "recognition"

export interface InsightCard {
  title: string
  body: string
  type: InsightType
  area?: string
  icon: string
}

export interface InsightAgentInput {
  issues: Issue[]
  cityStats: CityStats
}

const VALID_TYPES = new Set<InsightType>([
  "trend",
  "prediction",
  "hotspot",
  "recognition",
])

// Returned on any Gemini failure or invalid JSON. Never thrown. Two cards so the
// section always has content even with zero AI budget.
const FALLBACK: InsightCard[] = [
  {
    title: "Report early, fix faster",
    body: "Issues flagged by more neighbours get prioritised — every confirmation pushes a fix higher up the queue.",
    type: "trend",
    icon: "📣",
  },
  {
    title: "Monsoon is coming",
    body: "Bengaluru roads take a beating once the rains hit. Reporting potholes now means they can be patched before they widen.",
    type: "prediction",
    icon: "🌧️",
  },
]

const SYSTEM_PROMPT = `
You are a civic-data analyst for Bengaluru, India. You read a snapshot of live
civic-issue reports (potholes, water leakage, streetlights, garbage, footpaths,
encroachment) and write short, sharp, *predictive* insights for residents.

Ground every insight in real Bengaluru context:
- Monsoon patterns: pre-monsoon (Jun) and the longer monsoon worsen potholes,
  water-logging and pipeline leaks; report before the rains for faster patching.
- Infrastructure cycles: BBMP handles roads/footpaths/garbage; BWSSB handles
  water/sewage; BESCOM handles streetlights. Name the right agency when relevant.
- Hyperlocal language: use the actual area/block names from the data
  (e.g. "Koramangala 4th Block", "Whitefield ITPL", "BTM", "Marathahalli").

Tone: warm, neighbourly, action-oriented — never corporate, never alarmist.
Respond with ONLY a valid JSON array — no markdown fences, no preamble.
`.trim()

/** Compact, model-friendly digest of the live data (keeps the prompt small). */
function buildDataDigest(input: InsightAgentInput): string {
  const { issues, cityStats } = input

  const areas = groupIssuesByArea(issues)
    .slice(0, 10)
    .map((g) => {
      const open = g.issues.filter((i) => i.status !== "RESOLVED").length
      const resolved = g.count - open
      // Per-area type breakdown for "shared pipeline / hotspot" reasoning.
      const types = new Map<string, number>()
      for (const i of g.issues) {
        types.set(i.issue_type, (types.get(i.issue_type) ?? 0) + 1)
      }
      const typeStr = [...types.entries()]
        .map(([t, c]) => `${t}:${c}`)
        .join(", ")
      return `- ${g.area}: ${g.count} total (${open} open, ${resolved} resolved) [${typeStr}]`
    })
    .join("\n")

  const categories = computeByCategory(issues)
    .map((c) => `${c.label}: ${c.count}`)
    .join(", ")

  return `
City-wide stats:
- Total reported: ${cityStats.totalReported}
- Resolved this month: ${cityStats.resolvedThisMonth} (${cityStats.resolvedThisMonthPct}%)
- Average resolution time: ${
    cityStats.avgResolutionDays != null
      ? `${cityStats.avgResolutionDays} days`
      : "unknown"
  }
- Most active area: ${cityStats.mostActiveArea?.area ?? "n/a"}

By category: ${categories || "none"}

By area (top 10):
${areas || "no issues yet"}
`.trim()
}

function buildUserPrompt(input: InsightAgentInput): string {
  return `
Here is a live snapshot of civic issues in Bengaluru:

${buildDataDigest(input)}

Write EXACTLY 3 insight cards as a JSON array. Each card must be grounded in the
data above (cite real area names and counts) and read like a knowledgeable
neighbour talking to the community.

Return ONLY this exact JSON structure, nothing else:
[
  {
    "title": "short punchy headline (max ~8 words)",
    "body": "1-2 sentences. Cite specific areas/numbers. Predictive + actionable.",
    "type": "trend" | "prediction" | "hotspot" | "recognition",
    "area": "the specific neighbourhood this is about, if any (optional)",
    "icon": "one relevant emoji"
  }
]

Aim for variety across the 3 cards — a mix of types. Examples of the QUALITY and
STYLE to aim for (do NOT copy verbatim; use the real data):
- "Koramangala 4th Block has 2 unresolved potholes — historically this area sees spikes after rain. Report now before the monsoon hits." (type: prediction, hotspot)
- "Whitefield ITPL resolved a garbage issue in 4 days — faster than the city average of 9 days. 👏" (type: recognition)
- "3 water leakage reports across Marathahalli and BTM — could indicate a shared pipeline issue worth flagging to BWSSB." (type: hotspot)
`.trim()
}

function sanitizeType(value: unknown): InsightType {
  return typeof value === "string" && VALID_TYPES.has(value as InsightType)
    ? (value as InsightType)
    : "trend"
}

function isValidCard(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.title === "string" &&
    v.title.trim().length > 0 &&
    typeof v.body === "string" &&
    v.body.trim().length > 0
  )
}

/** Coerce a raw object into a clean InsightCard (type-safe, trimmed). */
function toCard(raw: Record<string, unknown>): InsightCard {
  return {
    title: String(raw.title).trim(),
    body: String(raw.body).trim(),
    type: sanitizeType(raw.type),
    icon:
      typeof raw.icon === "string" && raw.icon.trim().length > 0
        ? raw.icon.trim()
        : "💡",
    ...(typeof raw.area === "string" && raw.area.trim().length > 0
      ? { area: raw.area.trim() }
      : {}),
  }
}

/**
 * Generate 3 predictive insight cards from the live data. Always resolves —
 * returns the 2-card FALLBACK on any Gemini error or invalid JSON, so the
 * dashboard's insight section is never empty. Never throws.
 */
export async function generateInsights(
  input: InsightAgentInput
): Promise<InsightCard[]> {
  let result: unknown
  try {
    result = await generateJson<unknown>({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(input),
    })
  } catch {
    return FALLBACK
  }

  if (!Array.isArray(result)) return FALLBACK

  const cards = result.filter(isValidCard).map(toCard).slice(0, 3)

  // If Gemini returned an array but nothing usable, fall back rather than show empty.
  return cards.length > 0 ? cards : FALLBACK
}

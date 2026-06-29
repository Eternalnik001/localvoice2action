// ============================================================
// Agent 1 — Vision Analyst.
// Pure function: photo -> civic-issue classification. No Firestore here
// (persistence happens in the route handler). Calls Gemini via the shared
// generateJson() client, which is constrained to JSON output.
//
// Model: project standard gemini-3.5-flash (set via GEMINI_MODEL in the
// shared client). Gemini 1.5 is shut down / 404s; 2.x/3.x flash are the
// supported vision-capable tiers.
// ============================================================

import { createHash } from "node:crypto"
import { generateJson } from "@/lib/gemini/client"
import type { IssueType, Severity } from "@/lib/types"

export interface VisionAnalystInput {
  photoBase64: string
  mimeType: string
}

// Cache prevents repeat Gemini calls for the same photo — critical for demo-day quota.
// Keyed by SHA-256 of the first 10KB of the base64 photo; 1-hour TTL.
const CACHE_TTL_MS = 60 * 60 * 1000
const visionCache = new Map<string, { value: VisionAnalysis; expires: number }>()

function cacheKeyFor(photoBase64: string): string {
  return createHash("sha256").update(photoBase64.slice(0, 10_240)).digest("hex")
}

export interface VisionAnalysis {
  type: IssueType
  severity: Severity
  confidence: number
  description: string
  evidence: string[]
  suggestedTitle: string
}

const SYSTEM_PROMPT = `
You are a civic issue analyst for Indian municipal corporations (Bengaluru).
Analyze the image strictly for civic infrastructure problems visible in Indian
cities. Respond with ONLY valid JSON — no markdown fences, no preamble, no
explanation.
`.trim()

const USER_PROMPT = `
Analyze this image for a civic infrastructure issue in an Indian city.
Return ONLY this exact JSON structure, nothing else:
{
  "type": "POTHOLE|WATER_LEAKAGE|BROKEN_STREETLIGHT|GARBAGE_OVERFLOW|DAMAGED_FOOTPATH|ENCROACHMENT|OTHER|NOT_A_CIVIC_ISSUE",
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "confidence": 0.0,
  "description": "one sentence describing what you see",
  "evidence": ["specific visual element confirming the classification"],
  "suggestedTitle": "a short, human title for this issue (max 8 words)"
}
`.trim()

const MIN_CONFIDENCE = 0.4

const VALID_TYPES: ReadonlySet<string> = new Set<IssueType>([
  "POTHOLE",
  "WATER_LEAKAGE",
  "BROKEN_STREETLIGHT",
  "GARBAGE_OVERFLOW",
  "DAMAGED_FOOTPATH",
  "ENCROACHMENT",
  "OTHER",
  "NOT_A_CIVIC_ISSUE",
])
const VALID_SEVERITIES: ReadonlySet<string> = new Set<Severity>([
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
])

/** Validate the model's JSON has the shape + enum values we expect. */
function isVisionAnalysis(value: unknown): value is VisionAnalysis {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.type === "string" &&
    VALID_TYPES.has(v.type) &&
    typeof v.severity === "string" &&
    VALID_SEVERITIES.has(v.severity) &&
    typeof v.confidence === "number" &&
    typeof v.description === "string" &&
    Array.isArray(v.evidence) &&
    v.evidence.every((e) => typeof e === "string") &&
    typeof v.suggestedTitle === "string"
  )
}

/**
 * Classify a civic issue from a photo. Returns null (does not throw) when
 * Gemini fails, returns malformed/invalid JSON, or reports confidence < 0.4 —
 * the caller treats null as "couldn't analyse, ask the user to retry."
 */
export async function analyzePhoto(
  input: VisionAnalystInput
): Promise<VisionAnalysis | null> {
  // Cache hit → skip Gemini entirely (same photo resubmitted on retry).
  const key = cacheKeyFor(input.photoBase64)
  const hit = visionCache.get(key)
  if (hit && hit.expires > Date.now()) return hit.value

  let result: unknown
  try {
    result = await generateJson<unknown>({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: USER_PROMPT,
      images: [{ mimeType: input.mimeType, data: input.photoBase64 }],
    })
  } catch {
    // Gemini/network/parse failure — surface as null per the contract.
    return null
  }

  if (!isVisionAnalysis(result)) return null
  if (result.confidence < MIN_CONFIDENCE) return null

  visionCache.set(key, { value: result, expires: Date.now() + CACHE_TTL_MS })
  return result
}

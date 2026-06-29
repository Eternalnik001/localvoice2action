// ============================================================
// Agent 5 — Resolution Verifier.
// Pure function: before + after photos -> was the issue genuinely fixed?
// Both images go to Gemini in ONE multimodal message (two image parts). Returns
// 'cant_tell' (never null) on low confidence or any failure — always a verdict.
// ============================================================

import { generateJson } from "@/lib/gemini/client"
import type { IssueType } from "@/lib/types"

export interface ResolutionVerifierInput {
  beforeBase64: string
  afterBase64: string
  mimeType: string
  issueType: IssueType
  originalDescription: string
}

export interface ResolutionVerdict {
  verdict: "resolved" | "partial" | "not_resolved" | "cant_tell"
  confidence: number
  reasoning: string
}

const MIN_CONFIDENCE = 0.5

const SYSTEM_PROMPT = `
You are a resolution verification agent for a civic issue platform in Bengaluru.
You compare a BEFORE photo and an AFTER photo of the same reported issue and
judge whether it was genuinely fixed. Be strict — a partial or cosmetic fix is
not "resolved". Respond with ONLY valid JSON, no markdown fences, no preamble.
`.trim()

function buildPrompt(input: ResolutionVerifierInput): string {
  return `
The originally reported issue was a ${input.issueType} described as:
"${input.originalDescription}"

Image 1 is the BEFORE photo (original report).
Image 2 is the AFTER photo (submitted as proof of a fix).

Compare the two images specifically for:
- whether the originally reported issue has actually been addressed,
- visible repair work in the AFTER photo,
- any remaining or partial problems.

Return ONLY this exact JSON, nothing else:
{
  "verdict": "resolved|partial|not_resolved|cant_tell",
  "confidence": 0.0,
  "reasoning": "1-2 plain sentences a citizen would understand (no jargon)"
}
`.trim()
}

const VALID = new Set(["resolved", "partial", "not_resolved", "cant_tell"])

function isVerdict(value: unknown): value is ResolutionVerdict {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.verdict === "string" &&
    VALID.has(v.verdict) &&
    typeof v.confidence === "number" &&
    typeof v.reasoning === "string"
  )
}

const CANT_TELL: ResolutionVerdict = {
  verdict: "cant_tell",
  confidence: 0,
  reasoning: "We couldn't tell from these two photos whether it's fixed yet.",
}

/**
 * Compare before/after photos. Always resolves to a verdict — returns
 * 'cant_tell' on any Gemini failure, invalid JSON, or confidence < 0.5.
 * Never null, never throws.
 */
export async function verifyResolution(
  input: ResolutionVerifierInput
): Promise<ResolutionVerdict> {
  let result: unknown
  try {
    result = await generateJson<unknown>({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildPrompt(input),
      images: [
        { mimeType: input.mimeType, data: input.beforeBase64 },
        { mimeType: input.mimeType, data: input.afterBase64 },
      ],
    })
  } catch {
    return CANT_TELL
  }

  if (!isVerdict(result)) return CANT_TELL
  if (result.confidence < MIN_CONFIDENCE) {
    return { ...result, verdict: "cant_tell" }
  }
  return {
    verdict: result.verdict,
    confidence: result.confidence,
    reasoning: result.reasoning.trim() || CANT_TELL.reasoning,
  }
}

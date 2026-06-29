// ============================================================
// Agent 4 — Community Validator.
// Pure function: cross-checks a community verifier's photo against the
// original reporter's photo to confirm they show the same civic issue.
// Two images in, an Agent4Output out. Returns a DISPUTED-style result on any
// Gemini failure (fail safe — don't falsely "confirm" on error).
// ============================================================

import { generateJson } from "@/lib/gemini/client"
import { AGENT4_SYSTEM_PROMPT, getAgent4UserPrompt } from "@/lib/gemini/prompts"
import type { Agent4Output } from "@/lib/types"

export interface CommunityValidatorInput {
  originalBase64: string
  originalMimeType: string
  verifierBase64: string
  verifierMimeType: string
  description: string
  upvotes: number
}

const VALID_VALIDATION = new Set(["CONFIRMED", "DISPUTED", "ESCALATED"])
const VALID_STATUS = new Set([
  "UNVERIFIED",
  "COMMUNITY_VERIFIED",
  "DISPUTED",
])

function isAgent4Output(value: unknown): value is Agent4Output {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.validation === "string" &&
    VALID_VALIDATION.has(v.validation) &&
    typeof v.verification_status === "string" &&
    VALID_STATUS.has(v.verification_status) &&
    typeof v.confidence === "number" &&
    typeof v.photos_match === "boolean" &&
    typeof v.reasoning === "string"
  )
}

const DISPUTED: Agent4Output = {
  validation: "DISPUTED",
  verification_status: "UNVERIFIED",
  confidence: 0,
  photos_match: false,
  reasoning: "Could not verify the photos automatically.",
}

/**
 * Validate a corroborating photo against the original. Never throws; on any
 * Gemini/parse failure returns a DISPUTED result (fail safe — we don't want a
 * model error to count as a false confirmation).
 */
export async function validateCommunityPhoto(
  input: CommunityValidatorInput
): Promise<Agent4Output> {
  try {
    const result = await generateJson<unknown>({
      systemPrompt: AGENT4_SYSTEM_PROMPT,
      userPrompt: getAgent4UserPrompt(input.description, input.upvotes),
      images: [
        { mimeType: input.originalMimeType, data: input.originalBase64 },
        { mimeType: input.verifierMimeType, data: input.verifierBase64 },
      ],
    })
    return isAgent4Output(result) ? result : DISPUTED
  } catch {
    return DISPUTED
  }
}

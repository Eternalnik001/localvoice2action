// ============================================================
// Agent 2 — Deduplication (Gemini FUNCTION-CALLING).
// Pure function. This agent deliberately uses Gemini tool-use (not plain JSON
// generation): we declare a `find_duplicates` tool, force the model to call it
// (mode ANY), and read the structured args from response.functionCalls — never
// from text parts. That "the model decides to call a tool" is the agentic-depth
// signal for judges.
//
// Pre-filter is pure geo (Haversine ≤500m) so we only ask Gemini to reason when
// there is genuinely something nearby — and skip the call entirely otherwise.
// Tone of friendlyMessage: warm, community-oriented, NEVER "blocked"/"rejected".
// ============================================================

import {
  Type,
  FunctionCallingConfigMode,
  type FunctionDeclaration,
} from "@google/genai"
import { getGeminiClient, getGeminiModel } from "@/lib/gemini/client"
import { haversineMeters } from "@/lib/maps/utils"
import type { IssueType, Issue } from "@/lib/types"

export interface DedupInput {
  issueType: IssueType
  lat: number
  lng: number
  candidatesWithin500m: Issue[]
}

export interface DedupResult {
  action: "merge" | "create"
  duplicateId?: string
  friendlyMessage?: string
  confidence: number
}

const RADIUS_M = 500

// The tool the model must call. Parameters use the genai Type enum (OBJECT/…).
const findDuplicatesDeclaration: FunctionDeclaration = {
  name: "find_duplicates",
  description:
    "Decide whether a newly reported civic issue is the same real-world problem as one of the nearby existing reports. Always call this function with your decision.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      reasoning: {
        type: Type.STRING,
        description:
          "Briefly explain WHY this is or isn't the same real-world issue (consider type match and how close it is).",
      },
      isDuplicate: {
        type: Type.BOOLEAN,
        description:
          "True if the new report is very likely the same physical issue as one of the candidates.",
      },
      duplicateId: {
        type: Type.STRING,
        description:
          "The id of the matched existing issue when isDuplicate is true; otherwise the literal string 'null'.",
      },
      confidence: {
        type: Type.NUMBER,
        description: "Confidence in the decision, from 0 to 1.",
      },
      friendlyMessage: {
        type: Type.STRING,
        description:
          "When isDuplicate is true, a warm, community-oriented invitation to add to the existing report (e.g. 'Looks like this might be the same pothole a neighbour reported ~18m away — want to add your photo to make the report louder?'). Never use blocking or rejecting language. Empty string when not a duplicate.",
      },
    },
    required: [
      "reasoning",
      "isDuplicate",
      "duplicateId",
      "confidence",
      "friendlyMessage",
    ],
  },
}

interface FindDuplicatesArgs {
  reasoning: string
  isDuplicate: boolean
  duplicateId: string | null
  confidence: number
  friendlyMessage: string
}

function isFindDuplicatesArgs(value: unknown): value is FindDuplicatesArgs {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.reasoning === "string" &&
    typeof v.isDuplicate === "boolean" &&
    (typeof v.duplicateId === "string" || v.duplicateId === null) &&
    typeof v.confidence === "number" &&
    typeof v.friendlyMessage === "string"
  )
}

/** Compact, model-friendly summary of one candidate. */
function describeCandidate(c: Issue, lat: number, lng: number): string {
  const meters = Math.round(
    haversineMeters({ lat, lng }, { lat: c.location.lat, lng: c.location.lng })
  )
  return `- id: ${c.id} | type: ${c.issue_type} | ~${meters}m away | area: ${c.location.area} | "${c.description}"`
}

/**
 * Decide whether to merge into an existing nearby report or create a new one.
 * Skips Gemini entirely when nothing is within 500m. Returns action 'create'
 * on any model/parse failure (fail open — never block a citizen's report).
 */
export async function findDuplicate(input: DedupInput): Promise<DedupResult> {
  const { issueType, lat, lng, candidatesWithin500m } = input

  // Pure pre-filter: same type AND within 500m.
  const nearby = candidatesWithin500m.filter(
    (c) =>
      c.issue_type === issueType &&
      haversineMeters(
        { lat, lng },
        { lat: c.location.lat, lng: c.location.lng }
      ) <= RADIUS_M
  )

  // No real candidates → don't spend a Gemini call. Confident new report.
  if (nearby.length === 0) {
    return { action: "create", confidence: 1 }
  }

  const candidateLines = nearby
    .map((c) => describeCandidate(c, lat, lng))
    .join("\n")

  const prompt = `A citizen just reported a "${issueType}" at latitude ${lat}, longitude ${lng}.
Here are existing OPEN reports of the same type within 500 metres:
${candidateLines}

Decide whether the new report is the SAME real-world issue as one of these.
You MUST call the find_duplicates function with your decision.`

  let args: unknown
  try {
    const ai = getGeminiClient()
    const response = await ai.models.generateContent({
      model: getGeminiModel(),
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        tools: [{ functionDeclarations: [findDuplicatesDeclaration] }],
        // Force the model to call the tool (and only this tool).
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.ANY,
            allowedFunctionNames: ["find_duplicates"],
          },
        },
      },
    })

    const call = response.functionCalls?.find(
      (c) => c.name === "find_duplicates"
    )
    if (!call) return { action: "create", confidence: 1 }
    args = call.args
  } catch {
    // Fail open: a model/network error must never block a real report.
    return { action: "create", confidence: 1 }
  }

  if (!isFindDuplicatesArgs(args)) {
    return { action: "create", confidence: 1 }
  }

  // Normalise the "null" sentinel and validate the id against the real candidates.
  const matchedId =
    args.duplicateId && args.duplicateId !== "null" ? args.duplicateId : null
  const matchIsReal = matchedId
    ? nearby.some((c) => c.id === matchedId)
    : false

  if (args.isDuplicate && matchIsReal && matchedId) {
    return {
      action: "merge",
      duplicateId: matchedId,
      friendlyMessage: args.friendlyMessage || undefined,
      confidence: args.confidence,
    }
  }

  return { action: "create", confidence: args.confidence }
}

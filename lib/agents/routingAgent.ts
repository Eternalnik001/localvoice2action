// ============================================================
// Agent 3 — Routing.
// Pure function: issue (type + area + severity + description) -> the correct
// civic authority + a drafted complaint. Authority + ward are resolved
// DETERMINISTICALLY from lib/data/wardMapping (so any area routes correctly,
// mapped or not); Gemini only drafts the warm complaint text, with a
// deterministic fallback. ALWAYS produces an Agent3Output — never fails.
// ============================================================

import { generateJson } from "@/lib/gemini/client"
import {
  authorityForType,
  wardForArea,
} from "@/lib/data/wardMapping"
import type { Agent3Output, IssueType, Severity } from "@/lib/types"

export interface RoutingInput {
  issueType: IssueType
  area: string
  severity: Severity
  description: string
}

const SYSTEM_PROMPT = `
You draft a short, polite civic complaint for a Bengaluru municipal authority.
Return ONLY valid JSON, no markdown fences. Keep the complaint to 2 sentences,
factual and courteous.
`.trim()

function priorityFor(severity: Severity): Agent3Output["priority_flag"] {
  if (severity === "CRITICAL") return "EMERGENCY"
  if (severity === "HIGH") return "URGENT"
  return "NORMAL"
}

/** Deterministic complaint text — used as the Gemini fallback. */
function fallbackComplaint(
  input: RoutingInput,
  authorityName: string,
  ward: string,
  note?: string
): string {
  const where = note ? `${input.area} (${note})` : `${input.area} (${ward})`
  return `A ${input.issueType.replace(/_/g, " ").toLowerCase()} has been reported in ${where}: ${input.description}. Requesting ${authorityName} to inspect and resolve it promptly.`
}

/**
 * Route an issue to the right authority and draft a complaint. Always resolves
 * to a valid Agent3Output. Authority/ward/helpline/priority are deterministic;
 * only the complaint wording may come from Gemini (with a clean fallback).
 */
export async function routeIssue(input: RoutingInput): Promise<Agent3Output> {
  const authority = authorityForType(input.issueType)
  const ward = wardForArea(input.area)
  const priority = priorityFor(input.severity)
  const escalationDays = priority === "EMERGENCY" ? 2 : priority === "URGENT" ? 4 : 7

  const base: Agent3Output = {
    authority: authority.name,
    department: authority.department,
    complaint_text: fallbackComplaint(
      input,
      authority.name,
      ward.ward,
      ward.note
    ),
    escalation_threshold_days: escalationDays,
    helpline: authority.helpline,
    priority_flag: priority,
  }

  // Try to upgrade just the complaint wording via Gemini; never block on it.
  try {
    const drafted = await generateJson<{ complaint_text?: unknown }>({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: `Draft a 2-sentence civic complaint.
Issue type: ${input.issueType}
Area: ${input.area} (${ward.mapped ? ward.ward : ward.note})
Severity: ${input.severity}
Authority: ${authority.name} — ${authority.department}
Description: ${input.description}
Return ONLY: { "complaint_text": "..." }`,
    })
    if (typeof drafted.complaint_text === "string" && drafted.complaint_text.trim()) {
      return { ...base, complaint_text: drafted.complaint_text.trim() }
    }
  } catch {
    // fall through to the deterministic base
  }

  return base
}

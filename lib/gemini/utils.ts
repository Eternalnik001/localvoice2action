// ============================================================
// Gemini response helpers.
// Use parseGeminiResponse() for EVERY JSON.parse of model output.
// (With @google/genai we also set responseMimeType: "application/json"
//  on calls, but cleanJson stays as a defensive fallback.)
// ============================================================

/**
 * Strip markdown code fences that models sometimes wrap JSON in,
 * despite being told not to.
 */
export function cleanJson(raw: string): string {
  return raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim()
}

/**
 * Parse a Gemini text response into a typed object.
 * Throws a descriptive error (with a raw-text preview) on failure
 * so route handlers can surface a clean message to the client.
 */
export function parseGeminiResponse<T>(raw: string): T {
  const cleaned = cleanJson(raw)
  try {
    return JSON.parse(cleaned) as T
  } catch (err) {
    throw new Error(
      `Failed to parse Gemini response. Raw: ${raw.slice(0, 200)}`
    )
  }
}

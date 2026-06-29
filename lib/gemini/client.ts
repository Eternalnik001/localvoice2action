// ============================================================
// Gemini client — server-only.
// NEVER import this into a client component: it reads GEMINI_API_KEY,
// which must not reach the browser bundle (see .env.example).
//
// Uses @google/genai (the unified SDK). Model id comes from GEMINI_MODEL
// (gemini-3.5-flash). Every call goes through generateJson(), which sets
// responseMimeType: "application/json" and parses via the existing
// parseGeminiResponse() helper — never JSON.parse model output directly.
// ============================================================

import { GoogleGenAI } from "@google/genai"
import { parseGeminiResponse } from "@/lib/gemini/utils"

const DEFAULT_MODEL = "gemini-3.5-flash"

/** An inline image part for multimodal (vision) agents. */
export interface ImagePart {
  mimeType: string
  /** Base64-encoded image bytes (no data: prefix). */
  data: string
}

export interface GenerateJsonArgs {
  systemPrompt: string
  userPrompt: string
  /** Optional images for vision agents (Agent 1, Agent 5). */
  images?: ImagePart[]
}

/**
 * Assert the server has a Gemini key configured. Surfaces a clear error
 * instead of an opaque SDK throw. Note (from the decisions doc): the supplied
 * key starts with `AQ.` rather than the usual `AIza...` — if auth fails at
 * runtime, that mismatch is the first thing to check.
 */
export function assertGeminiEnv(): string {
  const key = process.env.GEMINI_API_KEY
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env.local (server-only, no NEXT_PUBLIC_ prefix)."
    )
  }
  return key
}

let cachedClient: GoogleGenAI | null = null

/**
 * The shared GoogleGenAI singleton. Exported so agents that need the raw SDK
 * (e.g. function-calling / tool-use, which generateJson can't express) reuse
 * the same client + key handling instead of constructing their own.
 */
export function getGeminiClient(): GoogleGenAI {
  const apiKey = assertGeminiEnv()
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({ apiKey })
  }
  return cachedClient
}

/** The model id all agents use (gemini-3.5-flash via GEMINI_MODEL). */
export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL || DEFAULT_MODEL
}

/**
 * Run a single-turn Gemini request constrained to JSON output and parse it
 * into T. Throws a descriptive error on auth/network/parse failure so route
 * handlers can decide whether to fall back or surface a clean message.
 */
export async function generateJson<T>({
  systemPrompt,
  userPrompt,
  images,
}: GenerateJsonArgs): Promise<T> {
  const ai = getGeminiClient()
  const model = getGeminiModel()

  const parts: Array<{ text: string } | { inlineData: ImagePart }> = [
    { text: userPrompt },
  ]
  for (const img of images ?? []) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } })
  }

  let rawText: string
  try {
    const request = ai.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
      },
    })

    // 8s timeout — prevents hanging if Gemini is slow during demo.
    // Resolves to null on expiry; we then throw so callers' existing
    // try/catch fall through to their agent fallbacks (fail-open).
    const TIMEOUT_MS = 8000
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<null>((resolve) => {
      timeoutId = setTimeout(() => resolve(null), TIMEOUT_MS)
    })

    const response = await Promise.race([request, timeout]).finally(() => {
      if (timeoutId) clearTimeout(timeoutId)
    })

    if (response === null) {
      throw new Error(`Gemini request timed out after ${TIMEOUT_MS}ms`)
    }

    rawText = response.text ?? ""
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Gemini request failed (model=${model}): ${message}`)
  }

  if (!rawText) {
    throw new Error(`Gemini returned an empty response (model=${model}).`)
  }

  return parseGeminiResponse<T>(rawText)
}

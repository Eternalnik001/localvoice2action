// ============================================================
// GET /api/insights — Gemini-powered predictive dashboard insights.
// Reads the live issue list + city stats from the DAL, asks the Insight Agent
// for 3 cards, and caches the result in memory for 60 minutes.
//
// ZERO-COST: insights are generated AT MOST once per hour, NOT per dashboard
// visit. Every request inside the 60-minute window returns the cached array
// with zero Gemini calls. The cache lives on globalThis so it survives Next
// dev hot-reloads (resets only on a cold start).
// ============================================================

import { NextResponse } from "next/server"
import { getStore } from "@/lib/data"
import { computeCityStats } from "@/lib/data/dashboardStats"
import { generateInsights, type InsightCard } from "@/lib/agents/insightAgent"

export const runtime = "nodejs"

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

interface InsightCacheEntry {
  insights: InsightCard[]
  cachedAt: number
}

// Persist across hot-reloads in dev; one shared entry (insights are city-wide).
const globalForInsights = globalThis as unknown as {
  __insightCache?: InsightCacheEntry
}

export async function GET() {
  try {
    const cached = globalForInsights.__insightCache
    const now = Date.now()

    // Fresh cache hit → return immediately, zero Gemini calls.
    if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
      return NextResponse.json(
        {
          insights: cached.insights,
          cachedAt: new Date(cached.cachedAt).toISOString(),
          fromCache: true,
        },
        { status: 200 }
      )
    }

    // Cold / stale → regenerate (at most once per hour).
    const issues = await getStore().listIssues()
    const cityStats = computeCityStats(issues, now)
    const insights = await generateInsights({ issues, cityStats })

    globalForInsights.__insightCache = { insights, cachedAt: now }

    return NextResponse.json(
      {
        insights,
        cachedAt: new Date(now).toISOString(),
        fromCache: false,
      },
      { status: 200 }
    )
  } catch (err) {
    // The agent never throws, but guard the DAL/stats path too: serve any stale
    // cache rather than 500, so the dashboard section degrades gracefully.
    const stale = globalForInsights.__insightCache
    if (stale) {
      return NextResponse.json(
        {
          insights: stale.insights,
          cachedAt: new Date(stale.cachedAt).toISOString(),
          fromCache: true,
        },
        { status: 200 }
      )
    }
    const message = err instanceof Error ? err.message : "Unexpected error."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

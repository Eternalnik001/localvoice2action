"use client"

// ============================================================
// InsightCards — client component for the dashboard's "AI insights" section.
// Fetches /api/insights on mount (the route caches for an hour, so this is
// cheap and almost always a cache hit). Shows 3 skeleton cards while loading.
// On fetch failure it collapses to nothing — no error state — so a transient
// blip never uglifies the dashboard.
// ============================================================

import { useEffect, useState } from "react"
import type { InsightCard, InsightType } from "@/lib/agents/insightAgent"

interface InsightsResponse {
  insights: InsightCard[]
  cachedAt: string
  fromCache: boolean
}

// Per-type styling: tint + badge label. hotspot=red, prediction=amber,
// trend=blue, recognition=green.
const TYPE_STYLE: Record<
  InsightType,
  { card: string; badge: string; label: string }
> = {
  hotspot: {
    card: "bg-red-50 dark:bg-red-900/20 ring-red-200 dark:ring-red-800/60",
    badge: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
    label: "Hotspot",
  },
  prediction: {
    card: "bg-amber-50 dark:bg-amber-900/20 ring-amber-200 dark:ring-amber-800/60",
    badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300",
    label: "Prediction",
  },
  trend: {
    card: "bg-blue-50 dark:bg-blue-900/20 ring-blue-200 dark:ring-blue-800/60",
    badge: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
    label: "Trend",
  },
  recognition: {
    card: "bg-emerald-50 dark:bg-emerald-900/20 ring-emerald-200 dark:ring-emerald-800/60",
    badge: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
    label: "Recognition",
  },
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800 p-4 ring-1 ring-slate-200 dark:ring-slate-700">
      <div className="h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-700" />
      <div className="mt-3 h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="mt-2 h-3 w-full rounded bg-slate-200 dark:bg-slate-700" />
      <div className="mt-1.5 h-3 w-5/6 rounded bg-slate-200 dark:bg-slate-700" />
    </div>
  )
}

function Card({ insight }: { insight: InsightCard }) {
  const style = TYPE_STYLE[insight.type]
  return (
    <div className={`rounded-2xl p-4 shadow-sm ring-1 ${style.card}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xl" aria-hidden>
          {insight.icon}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${style.badge}`}
        >
          {style.label}
        </span>
      </div>
      <p className="mt-2 font-medium text-slate-900 dark:text-slate-100">{insight.title}</p>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{insight.body}</p>
      {insight.area && (
        <p className="mt-2 text-xs font-medium text-slate-400 dark:text-slate-500">
          📍 {insight.area}
        </p>
      )}
    </div>
  )
}

export function InsightCards() {
  const [insights, setInsights] = useState<InsightCard[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/insights")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<InsightsResponse>
      })
      .then((data) => {
        if (cancelled) return
        setInsights(data.insights ?? [])
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setFailed(true)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Fetch failed → collapse gracefully (render nothing).
  if (failed) return null

  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        AI insights for Bengaluru
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">Updated hourly · Powered by Gemini</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading || insights === null ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          insights.map((insight, idx) => (
            <Card key={`${insight.title}-${idx}`} insight={insight} />
          ))
        )}
      </div>
    </section>
  )
}

export default InsightCards

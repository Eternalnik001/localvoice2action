// ============================================================
// Home page — server component. "The map is the product."
// Interactive map hero (Google Maps JS SDK loads on mount) + a recent-issues
// strip. Reads from the in-memory DAL. Zero Gemini; works with no Maps key
// (falls back to a grouped list).
// ============================================================

import Link from "next/link"
import { getStore } from "@/lib/data"
import { IssueMapOrList } from "@/components/map/IssueMapOrList"
import { RecentIssuesStrip } from "@/components/RecentIssuesStrip"
import { ErrorBoundary } from "@/components/ErrorBoundary"

export default async function HomePage() {
  const issues = await getStore().listIssues()
  const now = Date.now()

  // Headline stats.
  const resolvedCount = issues.filter((i) => i.status === "RESOLVED").length
  const areaCount = new Set(issues.map((i) => i.location.area)).size

  // 5 most recent.
  const recent = [...issues]
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    .slice(0, 5)

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      {/* Gradient hero */}
      <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-primary to-blue-900 dark:from-[#2e1065] dark:to-black px-6 py-7 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4 pr-12">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              LocalVoice2Action
            </h1>
            <p className="mt-1 text-blue-100 dark:text-violet-300">
              Every voice. Every street. Every fix.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20 backdrop-blur-sm transition hover:bg-white/25"
            >
              📊 Dashboard
            </Link>
            <Link
              href="/report"
              className="rounded-xl bg-brand-accent px-5 py-2.5 text-sm font-bold text-white shadow-md ring-1 ring-amber-700/30 transition hover:brightness-105"
            >
              📸 Report an issue
            </Link>
          </div>
        </div>

        {/* Stat chips */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:max-w-md sm:grid-cols-3">
          <div className="rounded-2xl bg-white/10 px-3 py-2.5 text-center ring-1 ring-white/15">
            <div className="text-2xl font-bold">{issues.length}</div>
            <div className="text-xs text-blue-100 dark:text-violet-300">issues reported</div>
          </div>
          <div className="rounded-2xl bg-white/10 px-3 py-2.5 text-center ring-1 ring-white/15">
            <div className="text-2xl font-bold">{resolvedCount}</div>
            <div className="text-xs text-blue-100 dark:text-violet-300">resolved</div>
          </div>
          <div className="col-span-2 rounded-2xl bg-white/10 px-3 py-2.5 text-center ring-1 ring-white/15 sm:col-span-1">
            <div className="text-2xl font-bold">{areaCount}</div>
            <div className="text-xs text-blue-100 dark:text-violet-300">neighbourhoods</div>
          </div>
        </div>
      </header>

      {/* Map hero (interactive on load; list fallback) */}
      <div className="mt-6">
        <ErrorBoundary>
          <IssueMapOrList issues={issues} />
        </ErrorBoundary>
      </div>

      {/* Recent issues strip */}
      <RecentIssuesStrip issues={recent} now={now} />
    </main>
  )
}
